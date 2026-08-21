using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Why an already-taken booking no longer fits its location's schedule. Editing opening
/// hours, open days or the walk-in policy never touches existing rows, so a booking taken
/// under the old schedule survives the edit and is only discoverable by re-evaluating it
/// against the current one.
/// </summary>
public enum ScheduleConflictReason
{
    /// <summary>The booking still falls inside a service the location currently runs.</summary>
    None,

    /// <summary>The booking's local day is no longer in <see cref="Restaurant.OpenDays"/>.</summary>
    ClosedDay,

    /// <summary>The day is open, but the booking starts outside that day's service window.</summary>
    OutsideHours,

    /// <summary>The location still opens then, but no longer takes bookings for that day.</summary>
    WalkInOnly,
}

/// <summary>
/// Re-evaluates an existing booking against the schedule a location has <em>now</em>.
/// <para>
/// The window arithmetic deliberately does not reuse <see cref="Restaurant.IsOpenAt"/>: that
/// one resolves an overnight service against the ISO day the instant itself falls on, so a
/// 00:30 sitting sold as part of Saturday's 18:00–02:00 service is judged against Sunday.
/// <c>AvailabilityService</c> emits exactly that slot, so reusing it would report a conflict
/// for a booking the product sold on purpose.
/// </para>
/// </summary>
/// <seealso>ScheduleConflictHelperTests.Evaluate_KeepsAfterMidnightSittingOfAnOvernightService</seealso>
/// <seealso>ScheduleConflictHelperTests.Evaluate_FlagsSittingOnADayThatIsNoLongerOpen</seealso>
public static class ScheduleConflictHelper
{
    public static ScheduleConflictReason Evaluate(Restaurant restaurant, DateTime bookingUtc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(bookingUtc, restaurant.Timezone);
        int isoDay = IsoDay.Of(local);
        int previousDay = isoDay == IsoDay.Monday ? IsoDay.Sunday : isoDay - 1;

        bool servedToday = IsOpenOn(restaurant, isoDay) && DayWindowCovers(restaurant, isoDay, local.TimeOfDay);
        bool servedByOvernightTail = IsOpenOn(restaurant, previousDay)
            && OvernightTailCovers(restaurant, previousDay, local.TimeOfDay);

        if (!servedToday && !servedByOvernightTail)
        {
            return IsOpenOn(restaurant, isoDay) ? ScheduleConflictReason.OutsideHours : ScheduleConflictReason.ClosedDay;
        }

        return WalkInHelper.IsWalkInOnlyAt(restaurant, bookingUtc)
            ? ScheduleConflictReason.WalkInOnly
            : ScheduleConflictReason.None;
    }

    private static bool IsOpenOn(Restaurant restaurant, int isoDay)
    {
        HashSet<int> openDays = IsoDay.ParseList(restaurant.OpenDays);
        return openDays.Count == 0 || openDays.Contains(isoDay);
    }

    /// <summary>The part of <paramref name="isoDay"/>'s service that falls on that same day.</summary>
    private static bool DayWindowCovers(Restaurant restaurant, int isoDay, TimeSpan timeOfDay)
    {
        (TimeSpan open, TimeSpan close) = ServiceWindowOn(restaurant, isoDay);
        if (open == close)
        {
            return true;
        }

        return close < open ? timeOfDay >= open : timeOfDay >= open && timeOfDay < close;
    }

    /// <summary>The part of <paramref name="isoDay"/>'s service that spills past midnight onto the next day.</summary>
    private static bool OvernightTailCovers(Restaurant restaurant, int isoDay, TimeSpan timeOfDay)
    {
        (TimeSpan open, TimeSpan close) = ServiceWindowOn(restaurant, isoDay);
        return close < open && timeOfDay < close;
    }

    private static (TimeSpan Open, TimeSpan Close) ServiceWindowOn(Restaurant restaurant, int isoDay)
    {
        (string openTime, string closeTime) = OpeningHoursHelper.GetHoursForDay(restaurant, isoDay);

        if (!OpeningHoursHelper.TryParseTime(openTime, out int openHour, out int openMin))
        {
            (openHour, openMin) = OpeningHourDefaults.OpenAt;
        }

        if (!OpeningHoursHelper.TryParseTime(closeTime, out int closeHour, out int closeMin))
        {
            (closeHour, closeMin) = OpeningHourDefaults.CloseAt;
        }

        return (new TimeSpan(openHour, openMin, 0), new TimeSpan(closeHour, closeMin, 0));
    }
}
