using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Guest booking reminders: a device opts in against one booking, and the reminder pass (driven
/// by <c>GuestReminderWorker</c>) pushes to it when a lead window opens. Opt-in and opt-out take
/// the reference-plus-email pair that is a guest's whole identity, and answer a miss with the same
/// false whether the reference is unknown or the email is wrong, for the reason
/// <c>BookingsController.GetBookingByRef</c> gives.
/// </summary>
public class GuestReminderService(
    IBookingRepository bookingRepository,
    IGuestPushSubscriptionRepository subscriptions,
    IGuestPushSender sender,
    BrandService brandService,
    IOptions<GuestPushSettings> settings,
    ISystemClock clock,
    ILogger<GuestReminderService> logger)
{
    private readonly GuestPushSettings _settings = settings.Value;

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_ReturnsFalseForAnUnknownRefOrWrongEmail</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_RejectsAnUnknownChannel</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_RequiresKeysOnTheWebPushChannel</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_RejectsACancelledBooking</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_RejectsABookingThatHasStarted</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_StoresTheSubscription</seealso>
    /// <seealso>GuestReminderServiceTests.SubscribeAsync_UpdatesAnExistingDeviceInsteadOfDuplicating</seealso>
    public virtual async Task<bool> SubscribeAsync(string bookingRef, string email, GuestReminderSubscribeRequest request)
    {
        Booking? booking = await FindOwnedAsync(bookingRef, email);
        if (booking is null)
        {
            return false;
        }

        if (!GuestPushChannels.IsKnown(request.Channel))
        {
            throw new ValidationException("Unknown reminder channel.") { Code = ErrorCodes.BookingReminderChannelInvalid };
        }

        if (request.Channel == GuestPushChannels.WebPush &&
            (string.IsNullOrWhiteSpace(request.P256dh) || string.IsNullOrWhiteSpace(request.Auth)))
        {
            throw new ValidationException("A Web Push subscription needs its p256dh and auth keys.") { Code = ErrorCodes.BookingReminderKeysRequired };
        }

        if (booking.IsCancelled)
        {
            throw new ConflictException("This booking has been cancelled.") { Code = ErrorCodes.BookingReminderCancelled };
        }

        if (booking.Date <= clock.UtcNow)
        {
            throw new ConflictException("This booking has already started.") { Code = ErrorCodes.BookingReminderTooLate };
        }

        string locale = SupportedLocales.IsSupported(request.Locale) ? request.Locale!.ToLowerInvariant() : SupportedLocales.Default;
        string endpoint = request.Endpoint.Trim();

        GuestPushSubscription? existing = await subscriptions.GetByBookingAndEndpointAsync(booking.Id, endpoint);
        if (existing is not null)
        {
            existing.Channel = request.Channel;
            existing.P256dh = request.P256dh;
            existing.Auth = request.Auth;
            existing.Locale = locale;
            await subscriptions.SaveChangesAsync();
            return true;
        }

        await subscriptions.AddAsync(new GuestPushSubscription
        {
            BookingId = booking.Id,
            Channel = request.Channel,
            Endpoint = endpoint,
            P256dh = request.P256dh,
            Auth = request.Auth,
            Locale = locale,
            CreatedAt = clock.UtcNow,
        });
        logger.LogInformation("[GuestPush] Device opted in to reminders for booking {BookingId}", booking.Id);
        return true;
    }

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>GuestReminderServiceTests.UnsubscribeAsync_ReturnsFalseForAnUnknownRefOrWrongEmail</seealso>
    /// <seealso>GuestReminderServiceTests.UnsubscribeAsync_RemovesOnlyThatDevice</seealso>
    /// <seealso>GuestReminderServiceTests.UnsubscribeAsync_IsIdempotent</seealso>
    public virtual async Task<bool> UnsubscribeAsync(string bookingRef, string email, string endpoint)
    {
        Booking? booking = await FindOwnedAsync(bookingRef, email);
        if (booking is null)
        {
            return false;
        }

        GuestPushSubscription? existing = await subscriptions.GetByBookingAndEndpointAsync(booking.Id, endpoint.Trim());
        if (existing is not null)
        {
            subscriptions.RemoveRange([existing]);
            await subscriptions.SaveChangesAsync();
        }

        return true;
    }

    /// <summary>
    /// One reminder pass: push to every subscription whose next lead window has opened, drop the
    /// addresses that no longer exist, and prune subscriptions for sittings that have started.
    /// Returns the number delivered.
    /// </summary>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_DeliversWhenAWindowOpens_AndRecordsTheLead</seealso>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_DoesNothingBeforeTheWindow</seealso>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_RemovesAStaleAddress</seealso>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_KeepsAFailedAddressButDoesNotRetryTheSameLead</seealso>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_PrunesSpentSubscriptions</seealso>
    /// <seealso>GuestReminderServiceTests.SendDueRemindersAsync_WritesTheReminderInTheGuestsLocaleAndTimezone</seealso>
    public virtual async Task<int> SendDueRemindersAsync()
    {
        DateTime now = clock.UtcNow;
        IReadOnlyList<int> leads = _settings.ReminderLeads();
        List<GuestPushSubscription> upcoming = await subscriptions.GetUpcomingAsync(now);

        string? websiteUrl = null;
        int delivered = 0;
        List<GuestPushSubscription> stale = [];

        foreach (GuestPushSubscription sub in upcoming)
        {
            int? lead = ReminderSchedule.DueLead(leads, sub.Booking.Date, sub.CreatedAt, sub.LastReminderLeadHours, now);
            if (lead is null)
            {
                continue;
            }

            websiteUrl ??= brandService.GetWebsiteUrl(await brandService.GetAsync());
            GuestPushMessage message = Compose(sub, now, websiteUrl);
            GuestPushResult result = await sender.SendAsync(sub, message);

            switch (result.Outcome)
            {
                case GuestPushOutcome.Delivered:
                    delivered++;
                    break;
                case GuestPushOutcome.Stale:
                    logger.LogWarning("[GuestPush] Address gone for subscription {Id}; removing", sub.Id);
                    stale.Add(sub);
                    continue;
                default:
                    logger.LogError("[GuestPush] Reminder for subscription {Id} failed: {Error}", sub.Id, result.Error);
                    break;
            }

            // Recorded on failure too: a provider that keeps refusing is not made to accept by
            // being asked again every minute, and the next lead window still gets its own attempt.
            sub.LastReminderLeadHours = lead;
            sub.LastReminderSentAt = now;
        }

        if (stale.Count > 0)
        {
            subscriptions.RemoveRange(stale);
        }

        await subscriptions.SaveChangesAsync();

        int pruned = await subscriptions.PruneSpentAsync(now);
        if (pruned > 0)
        {
            logger.LogInformation("[GuestPush] Pruned {Count} spent subscription(s)", pruned);
        }

        return delivered;
    }

    private GuestPushMessage Compose(GuestPushSubscription sub, DateTime nowUtc, string websiteUrl)
    {
        Booking booking = sub.Booking;
        string timezone = booking.Restaurant.Timezone;
        (string title, string body) = GuestReminderCopy.Build(
            sub.Locale,
            booking.Restaurant.Name,
            TimeZoneHelper.ConvertUtcToLocal(booking.Date, timezone),
            TimeZoneHelper.ConvertUtcToLocal(nowUtc, timezone),
            booking.Seats,
            booking.BookingRef);

        return new GuestPushMessage(title, body, booking.BookingRef, booking.Id, BookingLinks.Confirmation(websiteUrl, booking));
    }

    private async Task<Booking?> FindOwnedAsync(string bookingRef, string email)
    {
        Booking? booking = await bookingRepository.GetByRefAsync(bookingRef);
        if (booking is null)
        {
            return null;
        }

        return string.Equals(booking.CustomerEmail?.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase)
            ? booking
            : null;
    }
}
