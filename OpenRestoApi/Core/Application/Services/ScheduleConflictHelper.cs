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
/// Re-evaluates an existing booking against the schedule a location has <em>now</em>. Editing
/// hours, open days or the walk-in policy never touches rows already taken, so a booking sold
/// under the old schedule is only discoverable by asking this again.
/// </summary>
/// <seealso>ScheduleConflictHelperTests.Evaluate_KeepsAfterMidnightSittingOfAnOvernightService</seealso>
/// <seealso>ScheduleConflictHelperTests.Evaluate_FlagsSittingOnADayThatIsNoLongerOpen</seealso>
public static class ScheduleConflictHelper
{
    public static ScheduleConflictReason Evaluate(Restaurant restaurant, DateTime bookingUtc)
    {
        if (!ServiceWindowHelper.IsServingAt(restaurant, bookingUtc))
        {
            DateTime local = TimeZoneHelper.ConvertUtcToLocal(bookingUtc, restaurant.Timezone);
            return ServiceWindowHelper.IsOpenOn(restaurant, IsoDay.Of(local))
                ? ScheduleConflictReason.OutsideHours
                : ScheduleConflictReason.ClosedDay;
        }

        return WalkInHelper.IsWalkInOnlyAt(restaurant, bookingUtc)
            ? ScheduleConflictReason.WalkInOnly
            : ScheduleConflictReason.None;
    }
}
