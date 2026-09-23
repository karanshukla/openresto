using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Infrastructure.Waitlist;

/// <summary>
/// Runs <see cref="WaitlistService.SweepAsync"/> hourly, in <c>GuestReminderWorker</c>'s shape:
/// a scope per pass, a catch-all so one bad pass does not stop the next, and injectable
/// intervals so a test can drive the loop in milliseconds.
/// </summary>
/// <seealso>WaitlistSweepWorkerTests.RunsThePassRepeatedly</seealso>
/// <seealso>WaitlistSweepWorkerTests.SurvivesAFailedPass_AndTriesAgainOnTheNextTick</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.WaitlistSweepWorkerTests")]
[ExternalAccessAllowed]
internal sealed class WaitlistSweepWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<WaitlistSweepWorker> logger,
    TimeSpan? startupDelay = null,
    TimeSpan? interval = null) : BackgroundService
{
    private static readonly TimeSpan DefaultStartupDelay = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan DefaultInterval = TimeSpan.FromHours(1);

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
                await RunPassAsync();
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutdown, not a failure.
        }
    }

    private async Task RunPassAsync()
    {
        try
        {
            await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<WaitlistService>().SweepAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Waitlist] Sweep failed.");
        }
    }
}
