using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The API side of <see cref="OnlineBookingLimits"/>: the wording a hold or booking is turned
/// away with when it falls outside a location's horizon, notice or party size limits, and the
/// validation of those limits on their way in. Holds and booking creation reject on the same
/// rules, so they say the same thing.
/// </summary>
public static class BookingLimitsHelper
{
    public const int MaxHorizonDays = 365;
    public const int MaxNoticeMinutes = 7 * 24 * 60;

    public readonly record struct Rejection(
        string Message,
        string Code,
        IReadOnlyDictionary<string, object>? Args);

    /// <summary>
    /// Why an online sitting at <paramref name="bookingUtc"/> for <paramref name="seats"/> guests
    /// is refused by the limits, or null when it is inside all of them. The horizon is judged
    /// before the notice and the party size last, so a request wrong in several ways hears
    /// about the one that changes which day it should pick first.
    /// </summary>
    /// <seealso>BookingLimitsHelperTests.RejectionFor_IsNullInsideEveryLimit</seealso>
    /// <seealso>BookingLimitsHelperTests.RejectionFor_NamesTheHorizonForADayPastIt</seealso>
    /// <seealso>BookingLimitsHelperTests.RejectionFor_NamesTheNoticeForASittingTooSoon</seealso>
    /// <seealso>BookingLimitsHelperTests.RejectionFor_NamesTheMaximumForAPartyOverIt</seealso>
    public static Rejection? RejectionFor(Restaurant restaurant, DateTime bookingUtc, int seats, DateTime nowUtc)
    {
        if (restaurant.IsBeyondBookingHorizon(bookingUtc, nowUtc))
        {
            int days = restaurant.MaxBookingDaysAhead!.Value;
            return new Rejection(
                $"Online bookings can be made up to {days} days ahead.",
                ErrorCodes.BookingBeyondHorizon,
                new Dictionary<string, object> { ["days"] = days });
        }

        if (restaurant.IsInsideBookingNotice(bookingUtc, nowUtc))
        {
            int minutes = restaurant.MinBookingNoticeMinutes!.Value;
            return new Rejection(
                $"Online bookings need at least {minutes} minutes' notice.",
                ErrorCodes.BookingTooSoon,
                new Dictionary<string, object> { ["minutes"] = minutes });
        }

        if (restaurant.MinOnlinePartySize is int min && seats < min)
        {
            return new Rejection(
                $"Online bookings are for parties of {min} or more.",
                ErrorCodes.BookingPartyBelowOnlineMin,
                new Dictionary<string, object> { ["min"] = min });
        }

        if (restaurant.MaxOnlinePartySize is int max && seats > max)
        {
            return new Rejection(
                $"Online bookings are for parties of up to {max}. Please contact us for a larger group.",
                ErrorCodes.BookingPartyAboveOnlineMax,
                new Dictionary<string, object> { ["max"] = max });
        }

        return null;
    }

    /// <summary>
    /// Stores the four limits from an update request. Each is assigned unconditionally, null
    /// meaning off, the way the cover cap is: the settings form always sends them, so a
    /// conditional write could never clear one.
    /// </summary>
    /// <seealso>BookingLimitsHelperTests.Apply_AcceptsAHorizonOfZeroDays</seealso>
    /// <seealso>BookingLimitsHelperTests.Apply_RejectsANegativeHorizon</seealso>
    /// <seealso>BookingLimitsHelperTests.Apply_RejectsAMaximumBelowTheMinimum</seealso>
    public static void Apply(Restaurant restaurant, int? maxDaysAhead, int? minNoticeMinutes, int? minPartySize, int? maxPartySize)
    {
        if (maxDaysAhead is < 0 or > MaxHorizonDays)
        {
            throw new ValidationException($"MaxBookingDaysAhead must be between 0 and {MaxHorizonDays}, or null for no limit.")
            {
                Code = ErrorCodes.RestaurantBookingHorizonInvalid,
                Args = new Dictionary<string, object> { ["max"] = MaxHorizonDays }
            };
        }

        if (minNoticeMinutes is < 1 or > MaxNoticeMinutes)
        {
            throw new ValidationException($"MinBookingNoticeMinutes must be between 1 and {MaxNoticeMinutes}, or null for none.")
            {
                Code = ErrorCodes.RestaurantBookingNoticeInvalid,
                Args = new Dictionary<string, object> { ["max"] = MaxNoticeMinutes }
            };
        }

        int min = minPartySize ?? BookingLimits.MinSeats;
        int max = maxPartySize ?? BookingLimits.MaxSeats;
        if (min < BookingLimits.MinSeats || max > BookingLimits.MaxSeats || min > max)
        {
            throw new ValidationException(
                $"Online party size limits must run from at least {BookingLimits.MinSeats} to at most {BookingLimits.MaxSeats}, minimum first.")
            {
                Code = ErrorCodes.RestaurantOnlinePartySizeInvalid,
                Args = new Dictionary<string, object> { ["min"] = BookingLimits.MinSeats, ["max"] = BookingLimits.MaxSeats }
            };
        }

        restaurant.MaxBookingDaysAhead = maxDaysAhead;
        restaurant.MinBookingNoticeMinutes = minNoticeMinutes;
        restaurant.MinOnlinePartySize = minPartySize;
        restaurant.MaxOnlinePartySize = maxPartySize;
    }
}
