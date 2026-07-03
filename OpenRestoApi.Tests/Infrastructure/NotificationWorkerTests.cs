using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Notifications;

namespace OpenRestoApi.Tests.Infrastructure;

// A work item type the real pipeline never produces, used only to exercise
// NotificationWorker's `_ => Task.CompletedTask` default switch arm — the
// pattern match is exhaustive over the three real record types, so this is
// the only way to reach that branch.
internal sealed record UnknownWork : NotificationWorkItem;

public class NotificationWorkerTests
{
    private static (NotificationWorker Worker, NotificationQueue Queue, Mock<INotificationService> Notify) CreateWorker()
    {
        var queue = new NotificationQueue();
        var notifyMock = new Mock<INotificationService>();

        var spMock = new Mock<IServiceProvider>();
        spMock.Setup(sp => sp.GetService(typeof(INotificationService))).Returns(notifyMock.Object);

        var scopeMock = new Mock<IServiceScope>();
        scopeMock.Setup(s => s.ServiceProvider).Returns(spMock.Object);

        var scopeFactoryMock = new Mock<IServiceScopeFactory>();
        scopeFactoryMock.Setup(f => f.CreateScope()).Returns(scopeMock.Object);

        var worker = new NotificationWorker(queue, scopeFactoryMock.Object, NullLogger<NotificationWorker>.Instance);
        return (worker, queue, notifyMock);
    }

    [Fact]
    public async Task ProcessesBookingCreatedWork()
    {
        (NotificationWorker worker, NotificationQueue queue, Mock<INotificationService> notify) = CreateWorker();
        var booking = new Booking { BookingRef = "R1" };
        var tcs = new TaskCompletionSource();
        notify.Setup(n => n.NotifyBookingCreatedAsync(booking, "Resto"))
            .Callback(() => tcs.TrySetResult())
            .Returns(Task.CompletedTask);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            queue.EnqueueBookingCreated(booking, "Resto");
            await Task.WhenAny(tcs.Task, Task.Delay(2000));
            Assert.True(tcs.Task.IsCompletedSuccessfully);
            notify.Verify(n => n.NotifyBookingCreatedAsync(booking, "Resto"), Times.Once);
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ProcessesBookingCancelledWork()
    {
        (NotificationWorker worker, NotificationQueue queue, Mock<INotificationService> notify) = CreateWorker();
        var booking = new Booking { BookingRef = "R2" };
        var tcs = new TaskCompletionSource();
        notify.Setup(n => n.NotifyBookingCancelledAsync(booking, "Resto"))
            .Callback(() => tcs.TrySetResult())
            .Returns(Task.CompletedTask);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            queue.EnqueueBookingCancelled(booking, "Resto");
            await Task.WhenAny(tcs.Task, Task.Delay(2000));
            Assert.True(tcs.Task.IsCompletedSuccessfully);
            notify.Verify(n => n.NotifyBookingCancelledAsync(booking, "Resto"), Times.Once);
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ProcessesCapacityCheckWork()
    {
        (NotificationWorker worker, NotificationQueue queue, Mock<INotificationService> notify) = CreateWorker();
        DateTime date = DateTime.UtcNow;
        var tcs = new TaskCompletionSource();
        notify.Setup(n => n.CheckAndNotifyCapacityAsync(7, "Resto", date))
            .Callback(() => tcs.TrySetResult())
            .Returns(Task.CompletedTask);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            queue.EnqueueCapacityCheck(7, "Resto", date);
            await Task.WhenAny(tcs.Task, Task.Delay(2000));
            Assert.True(tcs.Task.IsCompletedSuccessfully);
            notify.Verify(n => n.CheckAndNotifyCapacityAsync(7, "Resto", date), Times.Once);
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task ExecuteAsync_CompletesGracefully_WhenChannelCompletes()
    {
        // Distinct from cancellation-driven shutdown (used by every other test's
        // StopAsync): completing the channel's writer lets the `await foreach` finish
        // enumeration on its own, so ExecuteAsync returns normally instead of the
        // loop being torn down by an OperationCanceledException.
        (NotificationWorker worker, NotificationQueue queue, _) = CreateWorker();
        queue.CompleteForTests();

        await worker.StartAsync(CancellationToken.None);

        Assert.NotNull(worker.ExecuteTask);
        await worker.ExecuteTask;
        Assert.Equal(TaskStatus.RanToCompletion, worker.ExecuteTask.Status);
    }

    [Fact]
    public async Task ContinuesProcessingAfterServiceThrows()
    {
        (NotificationWorker worker, NotificationQueue queue, Mock<INotificationService> notify) = CreateWorker();
        var failing = new Booking { BookingRef = "FAIL" };
        var succeeding = new Booking { BookingRef = "OK" };
        var tcs = new TaskCompletionSource();

        notify.Setup(n => n.NotifyBookingCreatedAsync(failing, "Resto"))
            .ThrowsAsync(new InvalidOperationException("boom"));
        notify.Setup(n => n.NotifyBookingCreatedAsync(succeeding, "Resto"))
            .Callback(() => tcs.TrySetResult())
            .Returns(Task.CompletedTask);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            queue.EnqueueBookingCreated(failing, "Resto");
            queue.EnqueueBookingCreated(succeeding, "Resto");

            await Task.WhenAny(tcs.Task, Task.Delay(2000));
            Assert.True(tcs.Task.IsCompletedSuccessfully);
            notify.Verify(n => n.NotifyBookingCreatedAsync(succeeding, "Resto"), Times.Once);
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task IgnoresUnrecognizedWorkItemTypes()
    {
        (NotificationWorker worker, NotificationQueue queue, Mock<INotificationService> notify) = CreateWorker();
        var afterUnknown = new Booking { BookingRef = "AFTER" };
        var tcs = new TaskCompletionSource();
        notify.Setup(n => n.NotifyBookingCreatedAsync(afterUnknown, "Resto"))
            .Callback(() => tcs.TrySetResult())
            .Returns(Task.CompletedTask);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            queue.TryWriteForTests(new UnknownWork());
            queue.EnqueueBookingCreated(afterUnknown, "Resto");

            await Task.WhenAny(tcs.Task, Task.Delay(2000));
            Assert.True(tcs.Task.IsCompletedSuccessfully);
            notify.Verify(n => n.NotifyBookingCreatedAsync(afterUnknown, "Resto"), Times.Once);
            notify.Verify(n => n.NotifyBookingCancelledAsync(It.IsAny<Booking>(), It.IsAny<string>()), Times.Never);
            notify.Verify(
                n => n.CheckAndNotifyCapacityAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<DateTime>()),
                Times.Never);
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }
}
