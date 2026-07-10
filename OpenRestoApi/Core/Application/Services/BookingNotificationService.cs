using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using WebPush;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IBookingNotificationService" />
public sealed class BookingNotificationService(
    IAdminNotificationRepository notificationRepository,
    IAdminPushSubscriptionRepository pushSubscriptionRepository,
    ITableRepository tableRepository,
    IBookingRepository bookingRepository,
    IOptions<VapidSettings> vapidOptions,
    IWebPushClient webPushClient,
    ILogger<BookingNotificationService> logger) : IBookingNotificationService
{
    private readonly IAdminNotificationRepository _notificationRepository = notificationRepository;
    private readonly IAdminPushSubscriptionRepository _pushSubscriptionRepository = pushSubscriptionRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly VapidSettings _vapid = vapidOptions.Value;
    private readonly IWebPushClient _webPushClient = webPushClient;
    private readonly ILogger<BookingNotificationService> _log = logger;

    // Fraction of tables booked on a day that triggers the RestaurantNearlyFull notification
    private const double _capacityThreshold = 0.8;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

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
        await _notificationRepository.AddAsync(notification);
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
        await _notificationRepository.AddAsync(notification);
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

        int totalTables = await _tableRepository.CountByRestaurantAsync(restaurantId);

        if (totalTables == 0)
        {
            _log.LogDebug("[Notif] Capacity check skipped: no tables for restaurant {RestaurantId}", restaurantId);
            return;
        }

        int bookedTables = await _bookingRepository.CountDistinctBookedTablesAsync(restaurantId, dayStart, dayEnd);

        double ratio = (double)bookedTables / totalTables;
        double previousRatio = (double)(bookedTables - 1) / totalTables;

        _log.LogDebug("[Notif] Capacity check: restaurant={Restaurant} booked={Booked}/{Total} ratio={Ratio:P0} threshold={Threshold:P0}",
            restaurantName, bookedTables, totalTables, ratio, _capacityThreshold);

        // Only fire when this booking pushes us across the threshold for the first time
        if (ratio < _capacityThreshold || previousRatio >= _capacityThreshold) return;

        // Deduplicate: don't fire if we already have a RestaurantNearlyFull notification for today
        bool alreadyFired = await _notificationRepository.ExistsNearlyFullForDayAsync(restaurantId, dayStart, dayEnd);

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
        await _notificationRepository.AddAsync(notification);

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

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task SendPushAsync(int restaurantId, int notificationId, PushPayload payload)
    {
        if (!_vapid.IsConfigured)
        {
            _log.LogDebug("[Push] Skipped — VAPID not configured");
            return;
        }

        List<AdminPushSubscription> subscriptions = await _pushSubscriptionRepository.GetByRestaurantAsync(restaurantId);

        _log.LogInformation("[Push] Sending notificationId={NotifId} to {Count} subscription(s) for restaurant {RestaurantId}",
            notificationId, subscriptions.Count, restaurantId);

        if (subscriptions.Count == 0) return;

        string json = JsonSerializer.Serialize(payload, _jsonOptions);

        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);
        List<AdminPushSubscription> stale = [];
        DateTime? sentAt = null;
        string? lastError = null;

        foreach (AdminPushSubscription sub in subscriptions)
        {
            var pushSub = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
            try
            {
                await _webPushClient.SendNotificationAsync(pushSub, json, vapidDetails);
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

        // Mirror the original single-SaveChangesAsync: stage stale removals + the notification
        // push-outcome update on the shared DbContext, then flush once.
        if (stale.Count > 0)
        {
            _pushSubscriptionRepository.RemoveRange(stale);
        }

        // Update the notification record with push outcome
        AdminNotification? record = await _notificationRepository.FindByIdAsync(notificationId);
        if (record is not null)
        {
            record.PushSentAt = sentAt;
            record.PushError = lastError;
        }

        await _notificationRepository.SaveChangesAsync();
    }

    private static string FormatUtcAsLocalTime(DateTime utc) =>
        utc.ToString("ddd d MMM 'at' h:mm tt", CultureInfo.InvariantCulture);
}
