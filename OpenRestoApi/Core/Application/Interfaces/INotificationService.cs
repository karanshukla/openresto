using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Request-scoped notification surface consumed by <c>NotificationsController</c>:
/// notification query/CRUD, push-subscription lifecycle, and VAPID public-key exposure.
/// Booking-event and capacity-threshold notifications live on
/// <see cref="IBookingNotificationService"/> (consumed by the background worker).
/// </summary>
public interface INotificationService
{
    Task<(List<AdminNotificationDto> Items, int TotalCount)> GetNotificationsAsync(
        int? restaurantId, string? type, bool? unreadOnly, int page, int pageSize);
    Task<int> GetUnreadCountAsync(int? restaurantId);
    Task MarkReadAsync(int notificationId);
    Task MarkAllReadAsync(int restaurantId);

    Task SubscribeAsync(int restaurantId, PushSubscribeRequest request);
    Task UnsubscribeAsync(string endpoint);
    Task DeleteByIdAsync(int notificationId);
    Task DeleteByIdsAsync(List<int> notificationIds);
    Task DeleteAllAsync(int? restaurantId, string? type, bool? unreadOnly);

    string? GetVapidPublicKey();
}
