using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Waitlist;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The scheduling around <see cref="WaitlistService.SweepAsync"/>. What a pass does is
/// <c>WaitlistServiceTests</c>' and <c>WaitlistRepositoryTests</c>'.
/// </summary>
public class WaitlistSweepWorkerTests
{
    private static readonly TimeSpan Immediately = TimeSpan.Zero;
    private static readonly TimeSpan Rapidly = TimeSpan.FromMilliseconds(20);

    private static Mock<WaitlistService> ServiceMock() => new(null!, null!, null!, null!, null!, null!, null!, null!, null!);

    private static WaitlistSweepWorker CreateWorker(Mock<WaitlistService> service, TimeSpan? startupDelay = null)
    {
        var provider = new Mock<IServiceProvider>();
        provider.Setup(p => p.GetService(typeof(WaitlistService))).Returns(service.Object);

        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(provider.Object);

        var factory = new Mock<IServiceScopeFactory>();
        factory.Setup(f => f.CreateScope()).Returns(scope.Object);

        return new WaitlistSweepWorker(factory.Object, NullLogger<WaitlistSweepWorker>.Instance, startupDelay ?? Immediately, Rapidly);
    }

    private static async Task RunUntilAsync(WaitlistSweepWorker worker, Func<bool> done)
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
        Mock<WaitlistService> service = ServiceMock();
        int passes = 0;
        service.Setup(s => s.SweepAsync())
            .Returns(Task.CompletedTask)
            .Callback(() => Interlocked.Increment(ref passes));

        await RunUntilAsync(CreateWorker(service), () => Volatile.Read(ref passes) >= 2);

        Assert.True(Volatile.Read(ref passes) >= 2, $"Expected repeated passes, saw {passes}.");
    }

    [Fact]
    public async Task SurvivesAFailedPass_AndTriesAgainOnTheNextTick()
    {
        Mock<WaitlistService> service = ServiceMock();
        int attempts = 0;
        service.Setup(s => s.SweepAsync())
            .Callback(() => Interlocked.Increment(ref attempts))
            .ThrowsAsync(new InvalidOperationException("database is locked"));

        await RunUntilAsync(CreateWorker(service), () => Volatile.Read(ref attempts) >= 2);

        Assert.True(Volatile.Read(ref attempts) >= 2, $"Expected a retry after the failure, saw {attempts}.");
    }

    [Fact]
    public async Task WaitsBeforeItsFirstPass_AndStopsCleanlyDuringTheWait()
    {
        Mock<WaitlistService> service = ServiceMock();
        WaitlistSweepWorker worker = CreateWorker(service, startupDelay: TimeSpan.FromMinutes(5));

        await worker.StartAsync(CancellationToken.None);
        await worker.StopAsync(CancellationToken.None);

        service.Verify(s => s.SweepAsync(), Times.Never);
        Assert.False(worker.ExecuteTask?.IsFaulted);
    }
}
