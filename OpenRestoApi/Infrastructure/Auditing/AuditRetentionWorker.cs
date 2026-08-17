using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Infrastructure.Auditing;

/// <summary>
/// Runs the audit retention pass once a day, following <c>NotificationWorker</c>'s shape: a
/// background service that opens its own scope per pass rather than holding a <c>DbContext</c>.
/// The first pass is deliberately delayed — a prune racing startup buys nothing, and a table
/// with a year of history in it is not urgent.
/// <para>
/// The two intervals are constructor parameters with production defaults so a test can drive
/// the loop in milliseconds; nothing else supplies them, and DI fills in the defaults.
/// </para>
/// <seealso>AuditRetentionWorkerTests.PrunesRepeatedly_RatherThanOnceAtStartup</seealso>
/// <seealso>AuditRetentionWorkerTests.SurvivesAFailedPass_AndTriesAgainOnTheNextTick</seealso>
/// <seealso>AuditRetentionWorkerTests.WaitsBeforeItsFirstPass_AndStopsCleanlyDuringTheWait</seealso>
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.AuditRetentionWorkerTests")]
[ExternalAccessAllowed]
internal sealed class AuditRetentionWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<AuditRetentionWorker> logger,
    TimeSpan? startupDelay = null,
    TimeSpan? interval = null) : BackgroundService
{
    private static readonly TimeSpan DefaultStartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan DefaultInterval = TimeSpan.FromDays(1);

    private readonly TimeSpan _startupDelay = startupDelay ?? DefaultStartupDelay;
    private readonly TimeSpan _interval = interval ?? DefaultInterval;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(_startupDelay, stoppingToken);

            using var timer = new PeriodicTimer(_interval);
            do
            {
                await PruneAsync();
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutdown, not a failure.
        }
    }

    private async Task PruneAsync()
    {
        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            var retention = scope.ServiceProvider.GetRequiredService<AuditRetentionService>();
            int removed = await retention.PruneAsync();
            if (removed > 0)
            {
                logger.LogInformation("[AuditRetention] Removed {Count} expired audit entries.", removed);
            }
        }
        catch (Exception ex)
        {
            // A failed prune must not take the worker down — the next tick tries again.
            logger.LogError(ex, "[AuditRetention] Prune pass failed.");
        }
    }
}
