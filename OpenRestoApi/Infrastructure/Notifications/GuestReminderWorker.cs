using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Infrastructure.Notifications;

/// <summary>
/// Runs the guest reminder pass once a minute, in <c>AuditRetentionWorker</c>'s shape: a scope
/// per pass, a catch-all so one bad pass does not stop the next, and injectable intervals so a
/// test can drive the loop in milliseconds.
/// </summary>
/// <seealso>GuestReminderWorkerTests.RunsThePassRepeatedly</seealso>
/// <seealso>GuestReminderWorkerTests.SurvivesAFailedPass_AndTriesAgainOnTheNextTick</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.GuestReminderWorkerTests")]
[ExternalAccessAllowed]
internal sealed class GuestReminderWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<GuestReminderWorker> logger,
    TimeSpan? startupDelay = null,
    TimeSpan? interval = null) : BackgroundService
{
    private static readonly TimeSpan DefaultStartupDelay = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan DefaultInterval = TimeSpan.FromMinutes(1);

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
            var reminders = scope.ServiceProvider.GetRequiredService<GuestReminderService>();
            int delivered = await reminders.SendDueRemindersAsync();
            if (delivered > 0)
            {
                logger.LogInformation("[GuestPush] Delivered {Count} booking reminder(s).", delivered);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[GuestPush] Reminder pass failed.");
        }
    }
}
