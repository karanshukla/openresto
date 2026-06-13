using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface INotificationService
{
    Task NotifyBookingCreatedAsync(Booking booking, string restaurantName);
    Task NotifyBookingCancelledAsync(Booking booking, string restaurantName);
    // Called after every booking creation — fires RestaurantNearlyFull if threshold crossed
    Task CheckAndNotifyCapacityAsync(int restaurantId, string restaurantName, DateTime bookingDate);
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
