using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Infrastructure.Notifications;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The scheduling around <see cref="GuestReminderService.SendDueRemindersAsync"/>: that it runs
/// repeatedly rather than once, that a failed pass does not take the worker down with it, and
/// that cancellation is a shutdown rather than a fault. What a pass does is
/// <c>GuestReminderServiceTests</c>'.
/// </summary>
public class GuestReminderWorkerTests
{
    private static readonly TimeSpan Immediately = TimeSpan.Zero;
    private static readonly TimeSpan Rapidly = TimeSpan.FromMilliseconds(20);

    private static Mock<GuestReminderService> RemindersMock() =>
        new(null!, null!, null!, null!, Options.Create(new GuestPushSettings()), null!, null!);

    private static GuestReminderWorker CreateWorker(
        Mock<GuestReminderService> reminders, TimeSpan? startupDelay = null, TimeSpan? interval = null)
    {
        var provider = new Mock<IServiceProvider>();
        provider.Setup(p => p.GetService(typeof(GuestReminderService))).Returns(reminders.Object);

        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(provider.Object);

        var factory = new Mock<IServiceScopeFactory>();
        factory.Setup(f => f.CreateScope()).Returns(scope.Object);

        return new GuestReminderWorker(
            factory.Object,
            NullLogger<GuestReminderWorker>.Instance,
            startupDelay ?? Immediately,
            interval ?? Rapidly);
    }

    private static async Task RunUntilAsync(GuestReminderWorker worker, Func<bool> done)
    {
        await worker.StartAsync(CancellationToken.None);
        try
        {
            for (int attempt = 0; attempt < 100 && !done(); attempt++)
            {
                await Task.Delay(20);
            }
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task RunsThePassRepeatedly()
    {
        Mock<GuestReminderService> reminders = RemindersMock();
        int passes = 0;
        reminders.Setup(r => r.SendDueRemindersAsync())
            .ReturnsAsync(1)
            .Callback(() => Interlocked.Increment(ref passes));

        await RunUntilAsync(CreateWorker(reminders), () => Volatile.Read(ref passes) >= 2);

        Assert.True(Volatile.Read(ref passes) >= 2, $"Expected repeated passes, saw {passes}.");
    }

    /// <summary>
    /// A pass that throws must not end the worker: every reminder after it would then silently
    /// never go out on an instance where one transient failure landed on the first tick.
    /// </summary>
    [Fact]
    public async Task SurvivesAFailedPass_AndTriesAgainOnTheNextTick()
    {
        Mock<GuestReminderService> reminders = RemindersMock();
        int attempts = 0;
        reminders.Setup(r => r.SendDueRemindersAsync())
            .Callback(() => Interlocked.Increment(ref attempts))
            .ThrowsAsync(new InvalidOperationException("database is locked"));

        await RunUntilAsync(CreateWorker(reminders), () => Volatile.Read(ref attempts) >= 2);

        Assert.True(Volatile.Read(ref attempts) >= 2, $"Expected a retry after the failure, saw {attempts}.");
    }

    [Fact]
    public async Task WaitsBeforeItsFirstPass_AndStopsCleanlyDuringTheWait()
    {
        Mock<GuestReminderService> reminders = RemindersMock();
        GuestReminderWorker worker = CreateWorker(reminders, startupDelay: TimeSpan.FromMinutes(5));

        await worker.StartAsync(CancellationToken.None);
        await worker.StopAsync(CancellationToken.None);

        reminders.Verify(r => r.SendDueRemindersAsync(), Times.Never);
        Assert.False(worker.ExecuteTask?.IsFaulted,
            "Cancelling during the startup wait is a shutdown, not a fault.");
    }
}
