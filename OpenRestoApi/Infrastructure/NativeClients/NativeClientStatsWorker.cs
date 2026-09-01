using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.NativeClients;

/// <summary>
/// Moves what <see cref="NativeClientStatsCollector"/> counted into the database once a minute,
/// in its own DI scope, and drops buckets past <see cref="RetentionDays"/>. Shaped like
/// <c>AuditRetentionWorker</c>: the interval is a constructor parameter with a production
/// default so a test can drive the loop in milliseconds, and a failed pass logs rather than
/// taking the worker down.
/// <para>
/// Shutdown flushes as well, so stopping the server does not throw away the minute since the
/// last tick.
/// </para>
/// </summary>
/// <seealso>NativeClientStatsWorkerTests.FlushesCollectedCountsIntoTheDatabase</seealso>
/// <seealso>NativeClientStatsWorkerTests.PrunesBucketsPastTheRetentionWindow</seealso>
/// <seealso>NativeClientStatsWorkerTests.AnIdlePassTouchesNoDatabase</seealso>
/// <seealso>NativeClientStatsWorkerTests.StopAsync_FlushesWhatTheLastTickDidNot</seealso>
/// <seealso>NativeClientStatsWorkerTests.SurvivesAFailedPass_AndTriesAgainOnTheNextTick</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientStatsWorkerTests")]
[ExternalAccessAllowed]
internal sealed class NativeClientStatsWorker(
    INativeClientStatsCollector collector,
    IServiceScopeFactory scopeFactory,
    ISystemClock clock,
    ILogger<NativeClientStatsWorker> logger,
    TimeSpan? interval = null) : BackgroundService
{
    /// <summary>How long a day's counts are kept. The screen reports a 30-day window; the rest is headroom.</summary>
    public const int RetentionDays = 90;

    private static readonly TimeSpan DefaultInterval = TimeSpan.FromMinutes(1);

    private readonly TimeSpan _interval = interval ?? DefaultInterval;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var timer = new PeriodicTimer(_interval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await FlushAsync();
            }
        }
        catch (OperationCanceledException)
        {
            // Shutdown, not a failure.
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        await FlushAsync();
    }

    private async Task FlushAsync()
    {
        IReadOnlyList<NativeClientObservation> observations = collector.Drain();
        if (observations.Count == 0) return;

        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            var repository = scope.ServiceProvider.GetRequiredService<INativeClientStatsRepository>();
            await repository.UpsertAsync(observations);
            await repository.PruneOlderThanAsync(clock.UtcNow.AddDays(-RetentionDays));
        }
        catch (Exception ex)
        {
            // A failed flush costs a minute of counts, not the worker — the next tick tries again.
            logger.LogError(ex, "[NativeClientStats] Flush pass failed.");
        }
    }
}
