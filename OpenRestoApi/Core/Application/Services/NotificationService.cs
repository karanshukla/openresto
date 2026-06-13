using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using WebPush;

namespace OpenRestoApi.Core.Application.Services;

public class NotificationService(AppDbContext db, IOptions<VapidSettings> vapidOptions, ILogger<NotificationService> logger) : INotificationService
{
    private readonly AppDbContext _db = db;
    private readonly VapidSettings _vapid = vapidOptions.Value;
    private readonly ILogger<NotificationService> _log = logger;

    // Fraction of tables booked on a day that triggers the RestaurantNearlyFull notification
    private const double _capacityThreshold = 0.8;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public string? GetVapidPublicKey() =>
        _vapid.IsConfigured ? _vapid.PublicKey : null;

    // ── Notify ───────────────────────────────────────────────────────────────

    public async Task NotifyBookingCreatedAsync(Booking booking, string restaurantName)
    {
        _log.LogInformation("[Notif] BookingCreated: ref={Ref} restaurant={Restaurant} seats={Seats}",
            booking.BookingRef, restaurantName, booking.Seats);

        var notification = new AdminNotification
        {
            RestaurantId = booking.RestaurantId,
            BookingId = booking.Id,
            BookingRef = booking.BookingRef,
            Type = NotificationType.BookingCreated,
            CustomerName = booking.CustomerName ?? "Guest",
            BookingDate = booking.Date,
            Seats = booking.Seats,
            RestaurantName = restaurantName,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };
        _db.AdminNotifications.Add(notification);
        await _db.SaveChangesAsync();
        _log.LogInformation("[Notif] BookingCreated saved id={Id}", notification.Id);

        string localTime = FormatUtcAsLocalTime(booking.Date);
        await SendPushAsync(
            booking.RestaurantId,
            notification.Id,
            new PushPayload(
                Title: $"New booking - {restaurantName}",
                Body: $"{booking.CustomerName ?? "Guest"} · {booking.Seats} guest{(booking.Seats == 1 ? "" : "s")} · {localTime}",
                Type: NotificationType.BookingCreated,
                BookingId: booking.Id,
                BookingRef: booking.BookingRef,
                RestaurantId: booking.RestaurantId
            ));
    }

    public async Task NotifyBookingCancelledAsync(Booking booking, string restaurantName)
    {
        _log.LogInformation("[Notif] BookingCancelled: ref={Ref} restaurant={Restaurant}",
            booking.BookingRef, restaurantName);

        var notification = new AdminNotification
        {
            RestaurantId = booking.RestaurantId,
            BookingId = booking.Id,
            BookingRef = booking.BookingRef,
            Type = NotificationType.BookingCancelled,
            CustomerName = booking.CustomerName ?? "Guest",
            BookingDate = booking.Date,
            Seats = booking.Seats,
            RestaurantName = restaurantName,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };
        _db.AdminNotifications.Add(notification);
        await _db.SaveChangesAsync();
        _log.LogInformation("[Notif] BookingCancelled saved id={Id}", notification.Id);

        string localTime = FormatUtcAsLocalTime(booking.Date);
        await SendPushAsync(
            booking.RestaurantId,
            notification.Id,
            new PushPayload(
                Title: $"Booking cancelled - {restaurantName}",
                Body: $"{booking.CustomerName ?? "Guest"} · {booking.Seats} guest{(booking.Seats == 1 ? "" : "s")} · {localTime}",
                Type: NotificationType.BookingCancelled,
                BookingId: booking.Id,
                BookingRef: booking.BookingRef,
                RestaurantId: booking.RestaurantId
            ));
    }

    public async Task CheckAndNotifyCapacityAsync(int restaurantId, string restaurantName, DateTime bookingDate)
    {
        // Count distinct tables booked on the same UTC calendar day
        DateTime dayStart = bookingDate.Date;
        DateTime dayEnd = dayStart.AddDays(1);

        int totalTables = await _db.Tables
            .CountAsync(t => t.Section!.RestaurantId == restaurantId);

        if (totalTables == 0)
        {
            _log.LogDebug("[Notif] Capacity check skipped: no tables for restaurant {RestaurantId}", restaurantId);
            return;
        }

        int bookedTables = await _db.Bookings
            .Where(b =>
                b.RestaurantId == restaurantId &&
                !b.IsCancelled &&
                b.TableId != null &&
                b.Date >= dayStart &&
                b.Date < dayEnd)
            .Select(b => b.TableId)
            .Distinct()
            .CountAsync();

        double ratio = (double)bookedTables / totalTables;
        double previousRatio = (double)(bookedTables - 1) / totalTables;

        _log.LogDebug("[Notif] Capacity check: restaurant={Restaurant} booked={Booked}/{Total} ratio={Ratio:P0} threshold={Threshold:P0}",
            restaurantName, bookedTables, totalTables, ratio, _capacityThreshold);

        // Only fire when this booking pushes us across the threshold for the first time
        if (ratio < _capacityThreshold || previousRatio >= _capacityThreshold) return;

        // Deduplicate: don't fire if we already have a RestaurantNearlyFull notification for today
        bool alreadyFired = await _db.AdminNotifications.AnyAsync(n =>
            n.RestaurantId == restaurantId &&
            n.Type == NotificationType.RestaurantNearlyFull &&
            n.BookingDate >= dayStart &&
            n.BookingDate < dayEnd);

        if (alreadyFired)
        {
            _log.LogDebug("[Notif] NearlyFull already fired today for restaurant {RestaurantId}", restaurantId);
            return;
        }

        var notification = new AdminNotification
        {
            RestaurantId = restaurantId,
            BookingId = null,
            BookingRef = string.Empty,
            Type = NotificationType.RestaurantNearlyFull,
            CustomerName = string.Empty,
            BookingDate = bookingDate,
            Seats = 0,
            RestaurantName = restaurantName,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };
        _db.AdminNotifications.Add(notification);
        await _db.SaveChangesAsync();

        await SendPushAsync(
            restaurantId,
            notification.Id,
            new PushPayload(
                Title: $"Nearly full - {restaurantName}",
                Body: $"{bookedTables} of {totalTables} tables booked today ({(int)(ratio * 100)}%)",
                Type: NotificationType.RestaurantNearlyFull,
                BookingId: null,
                BookingRef: null,
                RestaurantId: restaurantId
            ));
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    public async Task<(List<AdminNotificationDto> Items, int TotalCount)> GetNotificationsAsync(
        int? restaurantId, string? type, bool? unreadOnly, int page, int pageSize)
    {
        IQueryable<AdminNotification> q = _db.AdminNotifications.AsQueryable();

        if (restaurantId.HasValue)
            q = q.Where(n => n.RestaurantId == restaurantId.Value);

        if (!string.IsNullOrWhiteSpace(type))
            q = q.Where(n => n.Type == type);

        if (unreadOnly == true)
            q = q.Where(n => !n.IsRead);

        q = q.OrderByDescending(n => n.CreatedAt);

        int total = await q.CountAsync();
        List<AdminNotification> items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items.Select(ToDto).ToList(), total);
    }

    public async Task<int> GetUnreadCountAsync(int? restaurantId) =>
        await _db.AdminNotifications.CountAsync(n =>
            (!restaurantId.HasValue || n.RestaurantId == restaurantId.Value) && !n.IsRead);

    public async Task MarkReadAsync(int notificationId)
    {
        AdminNotification? n = await _db.AdminNotifications.FindAsync(notificationId);
        if (n is { IsRead: false })
        {
            n.IsRead = true;
            await _db.SaveChangesAsync();
        }
    }

    public async Task MarkAllReadAsync(int restaurantId) =>
        await _db.AdminNotifications
            .Where(n => n.RestaurantId == restaurantId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

    // ── Push subscriptions ────────────────────────────────────────────────────

    public async Task SubscribeAsync(int restaurantId, PushSubscribeRequest request)
    {
        // Deduplicate per (endpoint, restaurantId) so the same browser can receive
        // notifications for multiple restaurants independently.
        AdminPushSubscription? existing = await _db.AdminPushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint && s.RestaurantId == restaurantId);

        if (existing is not null)
        {
            existing.P256dh = request.P256dh;
            existing.Auth = request.Auth;
            existing.UserAgent = request.UserAgent;
            _log.LogInformation("[Push] Updated subscription id={Id} for restaurant {RestaurantId}", existing.Id, restaurantId);
        }
        else
        {
            _db.AdminPushSubscriptions.Add(new AdminPushSubscription
            {
                RestaurantId = restaurantId,
                Endpoint = request.Endpoint,
                P256dh = request.P256dh,
                Auth = request.Auth,
                UserAgent = request.UserAgent,
                CreatedAt = DateTime.UtcNow,
            });
            _log.LogInformation("[Push] New subscription for restaurant {RestaurantId} endpoint={Endpoint}",
                restaurantId, request.Endpoint[..Math.Min(60, request.Endpoint.Length)] + "…");
        }
        await _db.SaveChangesAsync();
    }

    public async Task UnsubscribeAsync(string endpoint)
    {
        // Remove all restaurant rows for this endpoint so a single unsubscribe
        // clears push across all locations.
        List<AdminPushSubscription> subs = await _db.AdminPushSubscriptions
            .Where(s => s.Endpoint == endpoint)
            .ToListAsync();
        if (subs.Count > 0)
        {
            _db.AdminPushSubscriptions.RemoveRange(subs);
            await _db.SaveChangesAsync();
            _log.LogInformation("[Push] Unsubscribed {Count} subscription(s) for endpoint={Endpoint}",
                subs.Count, endpoint[..Math.Min(60, endpoint.Length)] + "…");
        }
        else
        {
            _log.LogWarning("[Push] Unsubscribe called but no subscription found for endpoint={Endpoint}",
                endpoint[..Math.Min(60, endpoint.Length)] + "…");
        }
    }

    public async Task DeleteByIdAsync(int notificationId)
    {
        AdminNotification? n = await _db.AdminNotifications.FindAsync(notificationId);
        if (n is not null)
        {
            _db.AdminNotifications.Remove(n);
            await _db.SaveChangesAsync();
        }
    }

    public async Task DeleteByIdsAsync(List<int> notificationIds)
    {
        List<AdminNotification> notifications = await _db.AdminNotifications
            .Where(n => notificationIds.Contains(n.Id))
            .ToListAsync();

        if (notifications.Count > 0)
        {
            _db.AdminNotifications.RemoveRange(notifications);
            await _db.SaveChangesAsync();
        }
    }

    public async Task DeleteAllAsync(int? restaurantId, string? type, bool? unreadOnly)
    {
        IQueryable<AdminNotification> q = _db.AdminNotifications.AsQueryable();

        if (restaurantId.HasValue)
            q = q.Where(n => n.RestaurantId == restaurantId.Value);

        if (!string.IsNullOrWhiteSpace(type))
            q = q.Where(n => n.Type == type);

        if (unreadOnly == true)
            q = q.Where(n => !n.IsRead);

        await q.ExecuteDeleteAsync();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task SendPushAsync(int restaurantId, int notificationId, PushPayload payload)
    {
        if (!_vapid.IsConfigured)
        {
            _log.LogDebug("[Push] Skipped — VAPID not configured");
            return;
        }

        List<AdminPushSubscription> subscriptions = await _db.AdminPushSubscriptions
            .Where(s => s.RestaurantId == restaurantId)
            .ToListAsync();

        _log.LogInformation("[Push] Sending notificationId={NotifId} to {Count} subscription(s) for restaurant {RestaurantId}",
            notificationId, subscriptions.Count, restaurantId);

        if (subscriptions.Count == 0) return;

        string json = JsonSerializer.Serialize(payload, _jsonOptions);

        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);
        var client = new WebPushClient();
        List<AdminPushSubscription> stale = [];
        DateTime? sentAt = null;
        string? lastError = null;

        foreach (AdminPushSubscription sub in subscriptions)
        {
            var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
            try
            {
                await client.SendNotificationAsync(pushSub, json, vapidDetails);
                sentAt = DateTime.UtcNow;
                _log.LogInformation("[Push] Delivered sub={SubId} notifId={NotifId}", sub.Id, notificationId);
            }
            catch (WebPushException ex) when (
                ex.StatusCode == HttpStatusCode.Gone ||
                ex.StatusCode == HttpStatusCode.NotFound)
            {
                _log.LogWarning("[Push] Stale subscription sub={SubId} — removing", sub.Id);
                stale.Add(sub);
            }
            catch (WebPushException ex)
            {
                lastError = $"HTTP {(int)ex.StatusCode}: {ex.Message}";
                _log.LogError("[Push] Failed sub={SubId}: {Error}", sub.Id, lastError);
            }
        }

        if (stale.Count > 0)
        {
            _db.AdminPushSubscriptions.RemoveRange(stale);
        }

        // Update the notification record with push outcome
        AdminNotification? record = await _db.AdminNotifications.FindAsync(notificationId);
        if (record is not null)
        {
            record.PushSentAt = sentAt;
            record.PushError = lastError;
        }

        await _db.SaveChangesAsync();
    }

    private static string FormatUtcAsLocalTime(DateTime utc) =>
        utc.ToString("ddd d MMM 'at' h:mm tt", CultureInfo.InvariantCulture);

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
