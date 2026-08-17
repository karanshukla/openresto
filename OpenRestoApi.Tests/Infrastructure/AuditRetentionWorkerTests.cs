using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Infrastructure.Auditing;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The scheduling around <see cref="AuditRetentionService"/>: that it runs repeatedly rather
/// than once, that a failed pass doesn't take the worker down with it, and that cancellation is
/// a shutdown rather than a fault. The cutoff arithmetic is <c>AuditRetentionServiceTests</c>'.
/// </summary>
public class AuditRetentionWorkerTests
{
    private static readonly TimeSpan Immediately = TimeSpan.Zero;
    private static readonly TimeSpan Rapidly = TimeSpan.FromMilliseconds(20);

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => new(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc);
    }

    private static AuditRetentionWorker CreateWorker(
        Mock<IAdminAuditRepository> repository, TimeSpan? startupDelay = null, TimeSpan? interval = null)
    {
        var retention = new AuditRetentionService(
            repository.Object, new FixedClock(), Options.Create(new AuditSettings()));

        var provider = new Mock<IServiceProvider>();
        provider.Setup(p => p.GetService(typeof(AuditRetentionService))).Returns(retention);

        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(provider.Object);

        var factory = new Mock<IServiceScopeFactory>();
        factory.Setup(f => f.CreateScope()).Returns(scope.Object);

        return new AuditRetentionWorker(
            factory.Object,
            NullLogger<AuditRetentionWorker>.Instance,
            startupDelay ?? Immediately,
            interval ?? Rapidly);
    }

    private static async Task RunUntilAsync(AuditRetentionWorker worker, Func<bool> done)
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
    public async Task PrunesRepeatedly_RatherThanOnceAtStartup()
    {
        var repository = new Mock<IAdminAuditRepository>();
        int passes = 0;
        repository.Setup(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(1)
            .Callback(() => Interlocked.Increment(ref passes));

        await RunUntilAsync(CreateWorker(repository), () => Volatile.Read(ref passes) >= 2);

        Assert.True(Volatile.Read(ref passes) >= 2, $"Expected repeated passes, saw {passes}.");
    }

    /// <summary>
    /// A prune that throws must not end the worker: the table would then grow forever on an
    /// instance where one transient failure happened to land on the first tick.
    /// </summary>
    [Fact]
    public async Task SurvivesAFailedPass_AndTriesAgainOnTheNextTick()
    {
        var repository = new Mock<IAdminAuditRepository>();
        int attempts = 0;
        repository.Setup(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>()))
            .Callback(() => Interlocked.Increment(ref attempts))
            .ThrowsAsync(new InvalidOperationException("database is locked"));

        await RunUntilAsync(CreateWorker(repository), () => Volatile.Read(ref attempts) >= 2);

        Assert.True(Volatile.Read(ref attempts) >= 2, $"Expected a retry after the failure, saw {attempts}.");
    }

    /// <summary>
    /// A prune racing startup buys nothing, so the first pass waits — and stopping during that
    /// wait is a shutdown, not a fault.
    /// </summary>
    [Fact]
    public async Task WaitsBeforeItsFirstPass_AndStopsCleanlyDuringTheWait()
    {
        var repository = new Mock<IAdminAuditRepository>();
        AuditRetentionWorker worker = CreateWorker(repository, startupDelay: TimeSpan.FromMinutes(5));

        await worker.StartAsync(CancellationToken.None);
        await worker.StopAsync(CancellationToken.None);

        repository.Verify(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>()), Times.Never);
        // Not-faulted rather than completed-successfully: whether the loop ends as cancelled or
        // as returned is an implementation detail of how the delay observes the token, and
        // asserting on it makes the test fail under load without anything being wrong.
        Assert.False(worker.ExecuteTask?.IsFaulted,
            "Cancelling during the startup wait is a shutdown, not a fault.");
    }
}
