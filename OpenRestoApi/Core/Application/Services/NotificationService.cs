using System.Globalization;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class NotificationService(
    IAdminNotificationRepository notificationRepository,
    IAdminPushSubscriptionRepository pushSubscriptionRepository,
    IOptions<VapidSettings> vapidOptions,
    ILogger<NotificationService> logger,
    IAuditScope? audit = null) : INotificationService
{
    private readonly IAdminNotificationRepository _notificationRepository = notificationRepository;
    private readonly IAdminPushSubscriptionRepository _pushSubscriptionRepository = pushSubscriptionRepository;
    private readonly VapidSettings _vapid = vapidOptions.Value;
    private readonly ILogger<NotificationService> _log = logger;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public string? GetVapidPublicKey() =>
        _vapid.IsConfigured ? _vapid.PublicKey : null;

    // ── Query ─────────────────────────────────────────────────────────────────

    public async Task<(List<AdminNotificationDto> Items, int TotalCount)> GetNotificationsAsync(
        int? restaurantId, string? type, bool? unreadOnly, int page, int pageSize)
    {
        (List<AdminNotification> items, int total) = await _notificationRepository.QueryPagedAsync(restaurantId, type, unreadOnly, page, pageSize);
        return (items.Select(ToDto).ToList(), total);
    }

    public async Task<int> GetUnreadCountAsync(int? restaurantId) =>
        await _notificationRepository.CountUnreadAsync(restaurantId);

    public async Task MarkReadAsync(int notificationId) =>
        await _notificationRepository.MarkReadAsync(notificationId);

    public async Task MarkAllReadAsync(int restaurantId) =>
        await _notificationRepository.MarkAllReadAsync(restaurantId);

    // ── Push subscriptions ────────────────────────────────────────────────────

    public async Task SubscribeAsync(int restaurantId, PushSubscribeRequest request)
    {
        // Deduplicate per (endpoint, restaurantId) so the same browser can receive
        // notifications for multiple restaurants independently.
        AdminPushSubscription? existing = await _pushSubscriptionRepository.GetByEndpointAndRestaurantAsync(request.Endpoint, restaurantId);

        if (existing is not null)
        {
            existing.P256dh = request.P256dh;
            existing.Auth = request.Auth;
            existing.UserAgent = request.UserAgent;
            _log.LogInformation("[Push] Updated subscription id={Id} for restaurant {RestaurantId}", existing.Id, restaurantId);
            await _pushSubscriptionRepository.SaveChangesAsync();
        }
        else
        {
            await _pushSubscriptionRepository.AddAsync(new AdminPushSubscription
            {
                RestaurantId = restaurantId,
                Endpoint = request.Endpoint,
                P256dh = request.P256dh,
                Auth = request.Auth,
                UserAgent = request.UserAgent,
                CreatedAt = DateTime.UtcNow,
            });
            _log.LogInformation("[Push] New subscription for restaurant {RestaurantId}", restaurantId);
        }

        // No endpoint or key material: a push subscription's keys are credentials.
        _audit.Describe(AuditActions.PushSubscribe, restaurantId: restaurantId,
            summary: "Enabled push notifications for a device");
    }

    public async Task UnsubscribeAsync(string endpoint)
    {
        // Remove all restaurant rows for this endpoint so a single unsubscribe
        // clears push across all locations.
        List<AdminPushSubscription> subs = await _pushSubscriptionRepository.GetByEndpointAsync(endpoint);
        if (subs.Count > 0)
        {
            _pushSubscriptionRepository.RemoveRange(subs);
            await _pushSubscriptionRepository.SaveChangesAsync();
            _log.LogInformation("[Push] Unsubscribed {Count} subscription(s)", subs.Count);
            _audit.Describe(AuditActions.PushUnsubscribe,
                summary: $"Disabled push notifications for a device at {subs.Count} location(s)");
        }
        else
        {
            _log.LogWarning("[Push] Unsubscribe called but no matching subscription found");
        }
    }

    public async Task DeleteByIdAsync(int notificationId)
    {
        await _notificationRepository.DeleteByIdAsync(notificationId);
        _audit.Describe(AuditActions.NotificationDelete, AuditTargets.Notification,
            notificationId.ToString(CultureInfo.InvariantCulture), summary: "Deleted 1 notification");
    }

    public async Task DeleteByIdsAsync(List<int> notificationIds)
    {
        await _notificationRepository.DeleteByIdsAsync(notificationIds);
        _audit.Describe(AuditActions.NotificationDelete, AuditTargets.Notification,
            summary: $"Deleted {notificationIds.Count} notifications");
    }

    public async Task DeleteAllAsync(int? restaurantId, string? type, bool? unreadOnly)
    {
        await _notificationRepository.DeleteAllAsync(restaurantId, type, unreadOnly);
        _audit.Describe(AuditActions.NotificationDelete, AuditTargets.Notification,
            restaurantId: restaurantId, summary: "Cleared the matching notifications");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static AdminNotificationDto ToDto(AdminNotification n) => new(
        n.Id,
        n.RestaurantId,
        n.RestaurantName,
        n.BookingId,
        n.BookingRef,
        n.Type,
        n.CustomerName,
        n.BookingDate,
        n.Seats,
        n.IsRead,
        n.CreatedAt,
        n.PushSentAt,
        n.PushError
    );
}
