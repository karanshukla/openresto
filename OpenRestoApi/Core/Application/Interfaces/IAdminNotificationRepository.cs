using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of <see cref="AdminNotification"/> records (the in-app admin bell feed).
/// Includes bulk <c>ExecuteUpdate</c>/<c>ExecuteDelete</c> operations that bypass the change
/// tracker — implementations must preserve those bulk semantics, not convert to tracked add/remove.
/// </summary>
public interface IAdminNotificationRepository
{
    Task<AdminNotification?> FindByIdAsync(int id);

    /// <summary>Adds and saves a notification, returning the persisted entity with its assigned Id.</summary>
    Task<AdminNotification> AddAsync(AdminNotification notification);

    /// <summary>Filters by restaurantId / type / unreadOnly, orders by CreatedAt desc, applies paging, and returns the page plus total count.</summary>
    Task<(List<AdminNotification> Items, int TotalCount)> QueryPagedAsync(int? restaurantId, string? type, bool? unreadOnly, int page, int pageSize);

    /// <summary>Count of unread notifications, optionally scoped to a restaurant.</summary>
    Task<int> CountUnreadAsync(int? restaurantId);

    /// <summary>Marks a single notification read (no-op if already read or missing).</summary>
    Task MarkReadAsync(int notificationId);

    /// <summary>
    /// Bulk <c>ExecuteUpdate</c> — marks every unread notification for a restaurant as read in a single statement.
    /// Returns the number of rows affected.
    /// </summary>
    Task<int> MarkAllReadAsync(int restaurantId);

    /// <summary>Deletes a single notification by id (no-op if missing).</summary>
    Task DeleteByIdAsync(int notificationId);

    /// <summary>Deletes all notifications matching the supplied ids.</summary>
    Task DeleteByIdsAsync(List<int> notificationIds);

    /// <summary>
    /// Bulk <c>ExecuteDelete</c> — removes every notification matching the optional filters in a single statement.
    /// Returns the number of rows affected.
    /// </summary>
    Task<int> DeleteAllAsync(int? restaurantId, string? type, bool? unreadOnly);

    /// <summary>True if any <see cref="NotificationType.RestaurantNearlyFull"/> notification already exists for the UTC day window.</summary>
    Task<bool> ExistsNearlyFullForDayAsync(int restaurantId, DateTime dayStartUtc, DateTime dayEndUtc);

    /// <summary>Flushes pending changes on the underlying DbContext — used by NotificationService.SendPushAsync to persist subscription removals + the notification push outcome in one round-trip.</summary>
    Task SaveChangesAsync();
}
