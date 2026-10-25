namespace OpenRestoApi.Core.Domain;

/// <summary>
/// The service a location runs on a given ISO day, and whether an instant falls inside one.
/// <para>
/// A window whose close is earlier than its open runs past midnight, and all of it belongs to
/// the day it <em>opened</em>: a 00:30 sitting sold as part of Saturday's 18:00–02:00 service
/// is Saturday's, not Sunday's. Judging that instant against Sunday instead is what let
/// <c>AvailabilityService</c> offer a slot <c>HoldPolicyService</c> then refused, so every
/// caller answers the question here rather than re-deriving it.
/// </para>
/// </summary>
/// <seealso>ServiceWindowHelperTests.IsServingAt_AllowsAfterMidnightTailOfThePreviousDaysService</seealso>
/// <seealso>ServiceWindowHelperTests.IsServingAt_RejectsAfterMidnightTailWhenTheOpeningDayIsClosed</seealso>
/// <seealso>ServiceWindowHelperTests.IsServingAt_RejectsAfterMidnightTailAttributedToItsOwnDay</seealso>
public static class ServiceWindowHelper
{
    /// <summary>
    /// Whether <paramref name="isoDay"/> is one the location opens at all. An empty
    /// <see cref="Restaurant.OpenDays"/> means every day.
    /// </summary>
    public static bool IsOpenOn(Restaurant restaurant, int isoDay)
    {
        HashSet<int> openDays = IsoDay.ParseList(restaurant.OpenDays);
        return openDays.Count == 0 || openDays.Contains(isoDay);
    }

    /// <summary>
    /// Whether any service the location currently runs covers <paramref name="utc"/>. Two
    /// services can reach it: the one opening on its own local day, and the previous day's,
    /// if that one runs past midnight.
    /// </summary>
    public static bool IsServingAt(Restaurant restaurant, DateTime utc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(utc, restaurant.Timezone);
        int isoDay = IsoDay.Of(local);

        return OpensOntoTimeOfDay(restaurant, isoDay, local.TimeOfDay)
            || SpillsPastMidnightOnto(restaurant, DayBefore(isoDay), local.TimeOfDay);
    }

    /// <summary>
    /// Local start and end of the service opening on <paramref name="isoDay"/>, anchored on
    /// <paramref name="localDate"/>. An end at or before the start runs into the next day and
    /// is rolled forward, so the pair is always ordered.
    /// </summary>
    public static (DateTime Start, DateTime End) LocalWindowFor(Restaurant restaurant, DateTime localDate, int isoDay)
    {
        (TimeSpan open, TimeSpan close) = TimesOn(restaurant, isoDay);

        DateTime start = localDate.Date + open;
        DateTime end = localDate.Date + close;
        return (start, end <= start ? end.AddDays(1) : end);
    }

    /// <summary>
    /// Whether a new online booking may start at <paramref name="utc"/>: the instant has to be
    /// inside a service, as <see cref="IsServingAt"/> judges it, and at or before that service's
    /// last booking time when it has one. A service's cutoff belongs to the day the service
    /// opened, so an after-midnight cutoff is measured against the previous day's service and
    /// a sitting in the tail is judged against the tail's own cutoff, never the landing day's.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.IsAcceptingBookingsAt_AllowsTheLastBookingTimeItself</seealso>
    /// <seealso>ServiceWindowHelperTests.IsAcceptingBookingsAt_RefusesOneSlotAfterTheLastBookingTime</seealso>
    /// <seealso>ServiceWindowHelperTests.IsAcceptingBookingsAt_MeasuresAnAfterMidnightCutoffFromTheOpeningDay</seealso>
    public static bool IsAcceptingBookingsAt(Restaurant restaurant, DateTime utc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(utc, restaurant.Timezone);
        int isoDay = IsoDay.Of(local);
        DateTime dayBefore = local.Date.AddDays(-1);

        return (OpensOntoTimeOfDay(restaurant, isoDay, local.TimeOfDay)
                && IsBeforeCutoff(restaurant, local.Date, isoDay, local))
            || (SpillsPastMidnightOnto(restaurant, DayBefore(isoDay), local.TimeOfDay)
                && IsBeforeCutoff(restaurant, dayBefore, DayBefore(isoDay), local));
    }

    /// <summary>
    /// Local instant after which the service opening on <paramref name="isoDay"/> takes no new
    /// booking, anchored on <paramref name="localDate"/> the way <see cref="LocalWindowFor"/>
    /// anchors the window: a cutoff that reads earlier than the opening belongs to the next
    /// morning. Null when the day has no last booking time, and also when the stored value
    /// falls outside the window, since validation keeps it inside and a value outside has no
    /// reading that is not a guess.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.LastBookingCutoffFor_RollsACutoffBeforeOpeningIntoTheNextMorning</seealso>
    /// <seealso>ServiceWindowHelperTests.LastBookingCutoffFor_IgnoresACutoffOutsideTheWindow</seealso>
    public static DateTime? LastBookingCutoffFor(Restaurant restaurant, DateTime localDate, int isoDay)
    {
        if (!OpeningHours.TryParseTime(OpeningHours.GetLastBookingForDay(restaurant, isoDay), out int hour, out int minute))
        {
            return null;
        }

        (DateTime start, DateTime end) = LocalWindowFor(restaurant, localDate, isoDay);
        DateTime cutoff = localDate.Date + new TimeSpan(hour, minute, 0);
        if (cutoff < start)
        {
            cutoff = cutoff.AddDays(1);
        }

        return cutoff < end ? cutoff : null;
    }

    /// <summary>
    /// Whether <paramref name="isoDay"/>'s service, opening on <paramref name="serviceDate"/>,
    /// still takes a booking at <paramref name="local"/>: every service does until it has a
    /// last booking time, and the cutoff itself is the last start allowed.
    /// </summary>
    private static bool IsBeforeCutoff(Restaurant restaurant, DateTime serviceDate, int isoDay, DateTime local)
        => LastBookingCutoffFor(restaurant, serviceDate, isoDay) is not DateTime cutoff || local <= cutoff;

    /// <summary>
    /// Whether <paramref name="time"/> is a moment a service running <paramref name="open"/> to
    /// <paramref name="close"/> is serving: opening inclusive, closing exclusive, the two equal
    /// meaning all day, and a close before the open wrapping past midnight.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.CoversTimeOfDay_WrapsPastMidnight</seealso>
    public static bool CoversTimeOfDay(TimeSpan open, TimeSpan close, TimeSpan time)
    {
        if (open == close)
        {
            return true;
        }

        return close < open ? time >= open || time < close : time >= open && time < close;
    }

    private static int DayBefore(int isoDay) => isoDay == IsoDay.Monday ? IsoDay.Sunday : isoDay - 1;

    /// <summary>
    /// The part of <paramref name="isoDay"/>'s service that falls on <paramref name="isoDay"/>
    /// itself. A window that wraps has no upper bound here — its far side is the next day's
    /// problem, and crediting it to this day is what made the two callers disagree.
    /// </summary>
    private static bool OpensOntoTimeOfDay(Restaurant restaurant, int isoDay, TimeSpan timeOfDay)
    {
        if (!IsOpenOn(restaurant, isoDay))
        {
            return false;
        }

        (TimeSpan open, TimeSpan close) = TimesOn(restaurant, isoDay);
        if (open == close)
        {
            return true;
        }

        return close < open ? timeOfDay >= open : timeOfDay >= open && timeOfDay < close;
    }

    /// <summary>
    /// The part of <paramref name="isoDay"/>'s service that runs past midnight onto the
    /// following day, measured as a time of day on that following day.
    /// </summary>
    private static bool SpillsPastMidnightOnto(Restaurant restaurant, int isoDay, TimeSpan timeOfDay)
    {
        if (!IsOpenOn(restaurant, isoDay))
        {
            return false;
        }

        (TimeSpan open, TimeSpan close) = TimesOn(restaurant, isoDay);
        return close < open && timeOfDay < close;
    }

    private static (TimeSpan Open, TimeSpan Close) TimesOn(Restaurant restaurant, int isoDay)
    {
        (string openTime, string closeTime) = OpeningHours.GetHoursForDay(restaurant, isoDay);

        if (!OpeningHours.TryParseTime(openTime, out int openHour, out int openMin))
        {
            (openHour, openMin) = OpeningHourDefaults.OpenAt;
        }

        if (!OpeningHours.TryParseTime(closeTime, out int closeHour, out int closeMin))
        {
            (closeHour, closeMin) = OpeningHourDefaults.CloseAt;
        }

        return (new TimeSpan(openHour, openMin, 0), new TimeSpan(closeHour, closeMin, 0));
    }
}
