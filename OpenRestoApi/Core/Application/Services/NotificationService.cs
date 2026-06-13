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

public class NotificationService(AppDbContext db, IOptions<VapidSettings> vapidOptions) : INotificationService
{
    private readonly AppDbContext _db = db;
    private readonly VapidSettings _vapid = vapidOptions.Value;

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

        string localTime = FormatUtcAsLocalTime(booking.Date);
        await SendPushAsync(
            booking.RestaurantId,
            notification.Id,
            new PushPayload(
                Title: $"New booking — {restaurantName}",
                Body: $"{booking.CustomerName ?? "Guest"} · {booking.Seats} guest{(booking.Seats == 1 ? "" : "s")} · {localTime}",
                Type: NotificationType.BookingCreated,
                BookingId: booking.Id,
                BookingRef: booking.BookingRef,
                RestaurantId: booking.RestaurantId
            ));
    }

    public async Task NotifyBookingCancelledAsync(Booking booking, string restaurantName)
    {
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

        string localTime = FormatUtcAsLocalTime(booking.Date);
        await SendPushAsync(
            booking.RestaurantId,
            notification.Id,
            new PushPayload(
                Title: $"Booking cancelled — {restaurantName}",
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

        if (totalTables == 0) return;

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

        // Only fire when this booking pushes us across the threshold for the first time
        if (ratio < _capacityThreshold || previousRatio >= _capacityThreshold) return;

        // Deduplicate: don't fire if we already have a RestaurantNearlyFull notification for today
        bool alreadyFired = await _db.AdminNotifications.AnyAsync(n =>
            n.RestaurantId == restaurantId &&
            n.Type == NotificationType.RestaurantNearlyFull &&
            n.BookingDate >= dayStart &&
            n.BookingDate < dayEnd);

        if (alreadyFired) return;

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
                Title: $"Nearly full — {restaurantName}",
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

    public async Task<int> GetUnreadCountAsync(int restaurantId) =>
        await _db.AdminNotifications.CountAsync(n => n.RestaurantId == restaurantId && !n.IsRead);

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
        AdminPushSubscription? existing = await _db.AdminPushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint);

        if (existing is not null)
        {
            existing.P256dh = request.P256dh;
            existing.Auth = request.Auth;
            existing.UserAgent = request.UserAgent;
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
        }
        await _db.SaveChangesAsync();
    }

    public async Task UnsubscribeAsync(string endpoint)
    {
        AdminPushSubscription? sub = await _db.AdminPushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint);
        if (sub is not null)
        {
            _db.AdminPushSubscriptions.Remove(sub);
            await _db.SaveChangesAsync();
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task SendPushAsync(int restaurantId, int notificationId, PushPayload payload)
    {
        if (!_vapid.IsConfigured) return;

        List<AdminPushSubscription> subscriptions = await _db.AdminPushSubscriptions
            .Where(s => s.RestaurantId == restaurantId)
            .ToListAsync();

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
            }
            catch (WebPushException ex) when (
                ex.StatusCode == HttpStatusCode.Gone ||
                ex.StatusCode == HttpStatusCode.NotFound)
            {
                // Browser unsubscribed — clean it up
                stale.Add(sub);
            }
            catch (WebPushException ex)
            {
                lastError = $"HTTP {(int)ex.StatusCode}: {ex.Message}";
                Console.WriteLine($"[NotificationService] Push failed for sub {sub.Id}: {lastError}");
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
