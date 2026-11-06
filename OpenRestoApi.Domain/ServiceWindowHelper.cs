namespace OpenRestoApi.Core.Domain;

/// <summary>
/// The hours a location runs on one calendar date, once the weekly schedule and any
/// <see cref="DateException"/> on that date have been reconciled. <see cref="Open"/> and
/// <see cref="Close"/> are times of day; a close at or before the open runs past midnight.
/// </summary>
public readonly record struct DaySchedule(
    bool IsOpen,
    TimeSpan Open,
    TimeSpan Close,
    string? LastBooking,
    DateExceptionType? Exception);

/// <summary>
/// The service a location runs on a given date, and whether an instant falls inside one.
/// <para>
/// A window whose close is earlier than its open runs past midnight, and all of it belongs to
/// the day it <em>opened</em>: a 00:30 sitting sold as part of Saturday's 18:00–02:00 service
/// is Saturday's, not Sunday's. Judging that instant against Sunday instead is what let
/// <c>AvailabilityService</c> offer a slot <c>HoldPolicyService</c> then refused, so every
/// caller answers the question here rather than re-deriving it.
/// </para>
/// <para>
/// Every question is asked of a <em>date</em>, never of a weekday: a date exception can close
/// a Monday the week is open on, or open a Sunday with hours of its own, and the weekday alone
/// cannot tell.
/// </para>
/// </summary>
/// <seealso>ServiceWindowHelperTests.IsServingAt_AllowsAfterMidnightTailOfThePreviousDaysService</seealso>
/// <seealso>ServiceWindowHelperTests.IsServingAt_RejectsAfterMidnightTailWhenTheOpeningDayIsClosed</seealso>
/// <seealso>ServiceWindowHelperTests.IsServingAt_RejectsAfterMidnightTailAttributedToItsOwnDay</seealso>
public static class ServiceWindowHelper
{
    /// <summary>
    /// Whether the weekday <paramref name="isoDay"/> is one the weekly schedule opens on. An
    /// empty <see cref="Restaurant.OpenDays"/> means every day. Date exceptions are not
    /// consulted: ask <see cref="IsOpenOn(Restaurant, DateTime)"/> about a date.
    /// </summary>
    public static bool IsOpenOnWeekday(Restaurant restaurant, int isoDay)
    {
        HashSet<int> openDays = IsoDay.ParseList(restaurant.OpenDays);
        return openDays.Count == 0 || openDays.Contains(isoDay);
    }

    /// <summary>Whether the location runs a service opening on <paramref name="localDate"/>.</summary>
    public static bool IsOpenOn(Restaurant restaurant, DateTime localDate)
        => ScheduleFor(restaurant, localDate).IsOpen;

    /// <summary>
    /// The schedule for <paramref name="localDate"/>: the weekly hours for its weekday, unless a
    /// date exception closes the date, replaces the hours or keeps the date for walk-ins. A
    /// special-hours date is open whatever the weekly open days say, and carries only the
    /// exception's own last booking time, since the weekly one was set for different hours.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.ScheduleFor_ClosesAnOpenWeekdayOnAClosedDate</seealso>
    /// <seealso>ServiceWindowHelperTests.ScheduleFor_OpensAClosedWeekdayWithSpecialHours</seealso>
    /// <seealso>ServiceWindowHelperTests.ScheduleFor_KeepsTheWeeklyHoursOnAWalkInOnlyDate</seealso>
    /// <seealso>ServiceWindowHelperTests.ScheduleFor_DropsTheWeeklyLastBookingOnASpecialHoursDate</seealso>
    public static DaySchedule ScheduleFor(Restaurant restaurant, DateTime localDate)
    {
        int isoDay = IsoDay.Of(localDate);
        (TimeSpan open, TimeSpan close) = WeeklyTimesOn(restaurant, isoDay);
        DateException? exception = DateExceptions.For(restaurant, localDate);

        switch (exception?.Kind)
        {
            case DateExceptionType.Closed:
                return new DaySchedule(false, open, close, null, DateExceptionType.Closed);

            case DateExceptionType.SpecialHours:
                if (TryParseTimes(exception.Open, exception.Close, out TimeSpan specialOpen, out TimeSpan specialClose))
                {
                    open = specialOpen;
                    close = specialClose;
                }

                return new DaySchedule(
                    true,
                    open,
                    close,
                    OpeningHours.IsValidTime(exception.LastBooking) ? exception.LastBooking : null,
                    DateExceptionType.SpecialHours);

            case DateExceptionType.WalkInOnly:
                return new DaySchedule(
                    IsOpenOnWeekday(restaurant, isoDay),
                    open,
                    close,
                    OpeningHours.GetLastBookingForDay(restaurant, isoDay),
                    DateExceptionType.WalkInOnly);

            default:
                return new DaySchedule(
                    IsOpenOnWeekday(restaurant, isoDay),
                    open,
                    close,
                    OpeningHours.GetLastBookingForDay(restaurant, isoDay),
                    null);
        }
    }

    /// <summary>
    /// Whether any service the location currently runs covers <paramref name="utc"/>. Two
    /// services can reach it: the one opening on its own local date, and the previous date's,
    /// if that one runs past midnight.
    /// </summary>
    public static bool IsServingAt(Restaurant restaurant, DateTime utc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(utc, restaurant.Timezone);

        return OpensOntoTimeOfDay(restaurant, local.Date, local.TimeOfDay)
            || SpillsPastMidnightOnto(restaurant, local.Date.AddDays(-1), local.TimeOfDay);
    }

    /// <summary>
    /// Local start and end of the service opening on <paramref name="localDate"/>. An end at or
    /// before the start runs into the next day and is rolled forward, so the pair is always
    /// ordered. Asked of a closed date it still answers with the hours the date would run.
    /// </summary>
    public static (DateTime Start, DateTime End) LocalWindowFor(Restaurant restaurant, DateTime localDate)
    {
        DaySchedule schedule = ScheduleFor(restaurant, localDate);

        DateTime start = localDate.Date + schedule.Open;
        DateTime end = localDate.Date + schedule.Close;
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
        DateTime dayBefore = local.Date.AddDays(-1);

        return (OpensOntoTimeOfDay(restaurant, local.Date, local.TimeOfDay)
                && IsBeforeCutoff(restaurant, local.Date, local))
            || (SpillsPastMidnightOnto(restaurant, dayBefore, local.TimeOfDay)
                && IsBeforeCutoff(restaurant, dayBefore, local));
    }

    /// <summary>
    /// Local instant after which the service opening on <paramref name="localDate"/> takes no
    /// new booking, anchored the way <see cref="LocalWindowFor"/> anchors the window: a cutoff
    /// that reads earlier than the opening belongs to the next morning. Null when the date has
    /// no last booking time, and also when the stored value falls outside the window, since
    /// validation keeps it inside and a value outside has no reading that is not a guess.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.LastBookingCutoffFor_RollsACutoffBeforeOpeningIntoTheNextMorning</seealso>
    /// <seealso>ServiceWindowHelperTests.LastBookingCutoffFor_IgnoresACutoffOutsideTheWindow</seealso>
    public static DateTime? LastBookingCutoffFor(Restaurant restaurant, DateTime localDate)
    {
        DaySchedule schedule = ScheduleFor(restaurant, localDate);
        if (!OpeningHours.TryParseTime(schedule.LastBooking, out int hour, out int minute))
        {
            return null;
        }

        (DateTime start, DateTime end) = LocalWindowFor(restaurant, localDate);
        DateTime cutoff = localDate.Date + new TimeSpan(hour, minute, 0);
        if (cutoff < start)
        {
            cutoff = cutoff.AddDays(1);
        }

        return cutoff < end ? cutoff : null;
    }

    /// <summary>
    /// When the service running or still to come today ends, as a UTC instant, or null when
    /// nothing is left of today: the date is closed, or its service has already ended. The
    /// tail of yesterday's overnight service counts as today's current service while it runs,
    /// and the end is the closing time rather than the last booking time, because the pause
    /// gate (<see cref="Restaurant.IsPausedFor"/>) leaves its end instant bookable, which would
    /// leave the cutoff slot itself open.
    /// </summary>
    /// <seealso>ServiceWindowHelperTests.EndOfServiceToday_IsTodaysClose_BetweenOpeningAndClose</seealso>
    /// <seealso>ServiceWindowHelperTests.EndOfServiceToday_IsTodaysClose_BeforeTodaysService</seealso>
    /// <seealso>ServiceWindowHelperTests.EndOfServiceToday_IsNull_AfterTodaysService</seealso>
    /// <seealso>ServiceWindowHelperTests.EndOfServiceToday_IsNull_OnAClosedDate</seealso>
    /// <seealso>ServiceWindowHelperTests.EndOfServiceToday_FollowsYesterdaysServicePastMidnight</seealso>
    public static DateTime? EndOfServiceToday(Restaurant restaurant, DateTime nowUtc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(nowUtc, restaurant.Timezone);
        DateTime today = local.Date;
        DateTime yesterday = today.AddDays(-1);

        if (IsOpenOn(restaurant, yesterday))
        {
            (_, DateTime end) = LocalWindowFor(restaurant, yesterday);
            if (end > today && local < end)
            {
                return TimeZoneHelper.ConvertLocalToUtc(end, restaurant.Timezone);
            }
        }

        if (IsOpenOn(restaurant, today))
        {
            (_, DateTime end) = LocalWindowFor(restaurant, today);
            if (local < end)
            {
                return TimeZoneHelper.ConvertLocalToUtc(end, restaurant.Timezone);
            }
        }

        return null;
    }

    /// <summary>
    /// Whether the service opening on <paramref name="serviceDate"/> still takes a booking at
    /// <paramref name="local"/>: every service does until it has a last booking time, and the
    /// cutoff itself is the last start allowed.
    /// </summary>
    private static bool IsBeforeCutoff(Restaurant restaurant, DateTime serviceDate, DateTime local)
        => LastBookingCutoffFor(restaurant, serviceDate) is not DateTime cutoff || local <= cutoff;

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

    /// <summary>
    /// The part of <paramref name="localDate"/>'s service that falls on the date itself. A
    /// window that wraps has no upper bound here — its far side is the next day's problem, and
    /// crediting it to this day is what made the two callers disagree.
    /// </summary>
    private static bool OpensOntoTimeOfDay(Restaurant restaurant, DateTime localDate, TimeSpan timeOfDay)
    {
        DaySchedule schedule = ScheduleFor(restaurant, localDate);
        if (!schedule.IsOpen)
        {
            return false;
        }

        if (schedule.Open == schedule.Close)
        {
            return true;
        }

        return schedule.Close < schedule.Open
            ? timeOfDay >= schedule.Open
            : timeOfDay >= schedule.Open && timeOfDay < schedule.Close;
    }

    /// <summary>
    /// The part of <paramref name="localDate"/>'s service that runs past midnight onto the
    /// following day, measured as a time of day on that following day.
    /// </summary>
    private static bool SpillsPastMidnightOnto(Restaurant restaurant, DateTime localDate, TimeSpan timeOfDay)
    {
        DaySchedule schedule = ScheduleFor(restaurant, localDate);
        return schedule.IsOpen && schedule.Close < schedule.Open && timeOfDay < schedule.Close;
    }

    private static (TimeSpan Open, TimeSpan Close) WeeklyTimesOn(Restaurant restaurant, int isoDay)
    {
        (string openTime, string closeTime) = OpeningHours.GetHoursForDay(restaurant, isoDay);
        TryParseTimes(openTime, closeTime, out TimeSpan open, out TimeSpan close);
        return (open, close);
    }

    /// <summary>
    /// Both times as spans, falling back to the defaults for a value that does not parse so a
    /// stale row still yields a window. False when either fell back.
    /// </summary>
    private static bool TryParseTimes(string? openTime, string? closeTime, out TimeSpan open, out TimeSpan close)
    {
        bool openValid = OpeningHours.TryParseTime(openTime, out int openHour, out int openMin);
        if (!openValid)
        {
            (openHour, openMin) = OpeningHourDefaults.OpenAt;
        }

        bool closeValid = OpeningHours.TryParseTime(closeTime, out int closeHour, out int closeMin);
        if (!closeValid)
        {
            (closeHour, closeMin) = OpeningHourDefaults.CloseAt;
        }

        open = new TimeSpan(openHour, openMin, 0);
        close = new TimeSpan(closeHour, closeMin, 0);
        return openValid && closeValid;
    }
}
