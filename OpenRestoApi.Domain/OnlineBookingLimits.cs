namespace OpenRestoApi.Core.Domain;

/// <summary>
/// The limits a location puts on online bookings beyond its schedule: how far ahead a guest
/// may book (<see cref="Restaurant.MaxBookingDaysAhead"/>), how much notice a sitting needs
/// (<see cref="Restaurant.MinBookingNoticeMinutes"/>) and which party sizes the online form
/// takes at all (<see cref="Restaurant.MinOnlinePartySize"/>, <see cref="Restaurant.MaxOnlinePartySize"/>).
/// Availability, holds and booking creation all answer through here; staff bookings and the
/// waitlist never ask.
/// </summary>
public static class OnlineBookingLimits
{
    /// <summary>The furthest local date a guest may book, or null when the location sets no horizon.</summary>
    public static DateTime? LastBookableLocalDate(Restaurant restaurant, DateTime nowUtc)
        => restaurant.MaxBookingDaysAhead is int days
            ? TimeZoneHelper.ConvertUtcToLocal(nowUtc, restaurant.Timezone).Date.AddDays(days)
            : null;

    /// <summary>
    /// Whether the local date <paramref name="localDate"/> is past the horizon. The horizon counts
    /// calendar days in the restaurant's own clock, so a horizon of 0 is today only and a horizon
    /// of 30 reaches the same date next month.
    /// </summary>
    /// <seealso>OnlineBookingLimitsTests.IsBeyondHorizon_AllowsTheLastDayOfTheHorizon</seealso>
    /// <seealso>OnlineBookingLimitsTests.IsBeyondHorizon_RefusesTheDayAfterTheHorizon</seealso>
    public static bool IsBeyondHorizonOn(Restaurant restaurant, DateTime localDate, DateTime nowUtc)
        => LastBookableLocalDate(restaurant, nowUtc) is DateTime last && localDate.Date > last;

    public static bool IsBeyondHorizon(Restaurant restaurant, DateTime bookingUtc, DateTime nowUtc)
        => IsBeyondHorizonOn(restaurant, TimeZoneHelper.ConvertUtcToLocal(bookingUtc, restaurant.Timezone), nowUtc);

    /// <summary>
    /// Whether a sitting at <paramref name="bookingUtc"/> starts sooner than the minimum notice
    /// allows. A sitting exactly the notice away is accepted.
    /// </summary>
    /// <seealso>OnlineBookingLimitsTests.IsInsideNotice_AllowsASittingExactlyTheNoticeAway</seealso>
    /// <seealso>OnlineBookingLimitsTests.IsInsideNotice_RefusesASittingAMinuteShortOfTheNotice</seealso>
    public static bool IsInsideNotice(Restaurant restaurant, DateTime bookingUtc, DateTime nowUtc)
        => restaurant.MinBookingNoticeMinutes is int minutes and > 0 && bookingUtc < nowUtc.AddMinutes(minutes);

    /// <summary>Whether a party of <paramref name="seats"/> may book online at all.</summary>
    /// <seealso>OnlineBookingLimitsTests.AcceptsPartySize_AllowsBothBoundsInclusive</seealso>
    /// <seealso>OnlineBookingLimitsTests.AcceptsPartySize_RefusesOneOutsideEitherBound</seealso>
    public static bool AcceptsPartySize(Restaurant restaurant, int seats)
        => seats >= (restaurant.MinOnlinePartySize ?? 1)
            && (restaurant.MaxOnlinePartySize is not int max || seats <= max);
}
