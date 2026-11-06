using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class ServiceWindowHelperTests
{
    private static Restaurant NewRestaurant(
        string openTime = "09:00",
        string closeTime = "22:00",
        string openDays = "1,2,3,4,5,6,7",
        string? openHoursJson = null,
        string timezone = "UTC")
        => new()
        {
            Id = 1,
            Name = "T",
            OpenTime = openTime,
            CloseTime = closeTime,
            OpenDays = openDays,
            OpenHoursJson = openHoursJson,
            Timezone = timezone,
        };

    // 2026-01-10 is a Saturday, so 2026-01-11 is the Sunday that carries its overnight tail.
    private static DateTime SaturdayAt(int hour, int minute = 0) => new(2026, 1, 10, hour, minute, 0, DateTimeKind.Utc);
    private static DateTime SundayAt(int hour, int minute = 0) => new(2026, 1, 11, hour, minute, 0, DateTimeKind.Utc);

    private const string Saturday = "6";
    private const string Sunday = "7";

    // ── The overnight tail belongs to the day the service opened ───────────────

    [Fact]
    public void IsServingAt_AllowsAfterMidnightTailOfThePreviousDaysService()
    {
        // Saturday-only late-night venue, 18:00 through 02:00. The 00:30 sitting lands on
        // Sunday, a day the venue never opens, but it was sold as part of Saturday's service.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);

        Assert.True(ServiceWindowHelper.IsServingAt(r, SundayAt(0, 30)));
    }

    [Fact]
    public void IsServingAt_RejectsAfterMidnightTailWhenTheOpeningDayIsClosed()
    {
        // Same 00:30 instant, but now Sunday is the open day and Saturday is closed, so no
        // service reaches it: Sunday's own window has not started and Saturday runs nothing.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Sunday);

        Assert.False(ServiceWindowHelper.IsServingAt(r, SundayAt(0, 30)));
    }

    [Fact]
    public void IsServingAt_RejectsAfterMidnightTailAttributedToItsOwnDay()
    {
        // Saturday 00:30 is the tail of *Friday's* service, and Friday is closed. Crediting a
        // wrapping window's far side to the day it opened is what made the availability and
        // hold gates disagree.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);

        Assert.False(ServiceWindowHelper.IsServingAt(r, SaturdayAt(0, 30)));
        Assert.True(ServiceWindowHelper.IsServingAt(r, SaturdayAt(19)));
    }

    [Fact]
    public void IsServingAt_ResolvesTheTailAgainstTheOpeningDaysHours_NotTheLandingDays()
    {
        // Saturday runs 18:00–02:00, Sunday runs a lunch service. Sunday 00:30 is inside
        // neither of Sunday's own hours nor a uniform fallback — only Saturday's tail.
        Restaurant r = NewRestaurant(
            openHoursJson: """{"6":{"open":"18:00","close":"02:00"},"7":{"open":"11:00","close":"15:00"}}""");

        Assert.True(ServiceWindowHelper.IsServingAt(r, SundayAt(0, 30)));
        Assert.False(ServiceWindowHelper.IsServingAt(r, SundayAt(3)));
    }

    [Fact]
    public void IsServingAt_EndsTheTailAtTheOpeningDaysClosingTime()
    {
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);

        Assert.True(ServiceWindowHelper.IsServingAt(r, SundayAt(1, 59)));
        Assert.False(ServiceWindowHelper.IsServingAt(r, SundayAt(2)));
    }

    // ── The ordinary same-day window ──────────────────────────────────────────

    [Theory]
    [InlineData(9, true)]      // opens on the hour, inclusive
    [InlineData(12, true)]
    [InlineData(8, false)]
    [InlineData(22, false)]    // closes on the hour, exclusive
    public void IsServingAt_CoversTheDaysOwnWindow(int hour, bool expected)
    {
        Restaurant r = NewRestaurant();

        Assert.Equal(expected, ServiceWindowHelper.IsServingAt(r, SaturdayAt(hour)));
    }

    [Fact]
    public void IsServingAt_TreatsEqualOpenAndCloseAsAllDay()
    {
        Restaurant r = NewRestaurant(openTime: "00:00", closeTime: "00:00");

        Assert.True(ServiceWindowHelper.IsServingAt(r, SaturdayAt(3)));
    }

    [Fact]
    public void IsServingAt_FallsBackToDefaultHours_WhenStoredTimesAreUnparseable()
    {
        Restaurant r = NewRestaurant(openTime: "", closeTime: "");

        Assert.True(ServiceWindowHelper.IsServingAt(r, SaturdayAt(12)));
    }

    [Fact]
    public void IsServingAt_ResolvesTheInstantThroughTheRestaurantsTimezone()
    {
        // 03:00 UTC is 22:00 the previous day in New York, inside a 09:00–22:59 window.
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:59", timezone: "America/New_York");

        Assert.True(ServiceWindowHelper.IsServingAt(r, SundayAt(3)));
        Assert.False(ServiceWindowHelper.IsServingAt(r, SundayAt(8)));
    }

    // ── IsOpenOn ──────────────────────────────────────────────────────────────

    [Fact]
    public void IsOpenOn_TreatsAnEmptyDayListAsEveryDay()
    {
        Restaurant r = NewRestaurant(openDays: "");

        Assert.True(ServiceWindowHelper.IsOpenOnWeekday(r, 1));
        Assert.True(ServiceWindowHelper.IsOpenOnWeekday(r, 7));
    }

    [Fact]
    public void IsOpenOn_RejectsADayTheListOmits()
    {
        Restaurant r = NewRestaurant(openDays: Saturday);

        Assert.True(ServiceWindowHelper.IsOpenOnWeekday(r, 6));
        Assert.False(ServiceWindowHelper.IsOpenOnWeekday(r, 7));
    }

    // ── LocalWindowFor ────────────────────────────────────────────────────────

    [Fact]
    public void LocalWindowFor_KeepsASameDayWindowOnItsOwnDate()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate);

        Assert.Equal(new DateTime(2026, 1, 10, 11, 0, 0), start);
        Assert.Equal(new DateTime(2026, 1, 10, 23, 0, 0), end);
    }

    [Fact]
    public void LocalWindowFor_RollsAWrappingWindowIntoTheFollowingDay()
    {
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate);

        Assert.Equal(new DateTime(2026, 1, 10, 18, 0, 0), start);
        Assert.Equal(new DateTime(2026, 1, 11, 2, 0, 0), end);
    }

    [Fact]
    public void LocalWindowFor_SpansAFullDay_WhenOpenEqualsClose()
    {
        Restaurant r = NewRestaurant(openTime: "00:00", closeTime: "00:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate);

        Assert.Equal(TimeSpan.FromDays(1), end - start);
    }


    // ── Last booking time ─────────────────────────────────────────────────────

    [Fact]
    public void IsAcceptingBookingsAt_AllowsTheLastBookingTimeItself()
    {
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");
        r.LastBookingTime = "20:15";

        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SaturdayAt(20, 15)));
    }

    [Fact]
    public void IsAcceptingBookingsAt_RefusesOneSlotAfterTheLastBookingTime()
    {
        // Still inside the 09:00–22:00 service, so the venue is open; only the book is closed.
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");
        r.LastBookingTime = "20:15";

        Assert.False(ServiceWindowHelper.IsAcceptingBookingsAt(r, SaturdayAt(20, 30)));
        Assert.True(ServiceWindowHelper.IsServingAt(r, SaturdayAt(20, 30)));
    }

    [Fact]
    public void IsAcceptingBookingsAt_MatchesIsServingAt_WhenNoLastBookingTimeIsSet()
    {
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");

        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SaturdayAt(21, 45)));
        Assert.False(ServiceWindowHelper.IsAcceptingBookingsAt(r, SaturdayAt(22)));
    }

    [Fact]
    public void IsAcceptingBookingsAt_MeasuresAnAfterMidnightCutoffFromTheOpeningDay()
    {
        // Saturday 18:00–02:00 with the last booking at 00:30: Sunday 00:30 is still Saturday's
        // service and its own cutoff, Sunday 01:00 is past it.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);
        r.LastBookingTime = "00:30";

        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(0, 30)));
        Assert.False(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(1)));
        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SaturdayAt(23)));
    }

    [Fact]
    public void IsAcceptingBookingsAt_JudgesTheTailAgainstTheOpeningDaysCutoff_NotTheLandingDays()
    {
        // Saturday runs 18:00–02:00 with no cutoff; Sunday is a lunch service whose book closes
        // at 13:00. Sunday 01:00 is Saturday's tail, and Saturday's book is still open.
        Restaurant r = NewRestaurant(
            openHoursJson: """{"6":{"open":"18:00","close":"02:00"},"7":{"open":"11:00","close":"15:00","lastBooking":"13:00"}}""");

        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(1)));
        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(13)));
        Assert.False(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(13, 30)));
    }

    [Fact]
    public void LastBookingCutoffFor_RollsACutoffBeforeOpeningIntoTheNextMorning()
    {
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        r.LastBookingTime = "00:30";
        var saturday = new DateTime(2026, 1, 10);

        Assert.Equal(new DateTime(2026, 1, 11, 0, 30, 0), ServiceWindowHelper.LastBookingCutoffFor(r, saturday));
    }

    [Fact]
    public void LastBookingCutoffFor_IgnoresACutoffOutsideTheWindow()
    {
        // 23:00 is after a 22:00 close: validation never stores it, so a row that carries it is
        // read as having no cutoff rather than as closing the book at some guessed time.
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");
        r.LastBookingTime = "23:00";

        Assert.Null(ServiceWindowHelper.LastBookingCutoffFor(r, new DateTime(2026, 1, 10)));
    }

    [Fact]
    public void LastBookingCutoffFor_IsNullWithoutALastBookingTime()
    {
        Restaurant r = NewRestaurant();

        Assert.Null(ServiceWindowHelper.LastBookingCutoffFor(r, new DateTime(2026, 1, 10)));
    }

    [Theory]
    [InlineData("18:00", "02:00", "23:00", true)]
    [InlineData("18:00", "02:00", "01:59", true)]
    [InlineData("18:00", "02:00", "02:00", false)]
    [InlineData("18:00", "02:00", "12:00", false)]
    [InlineData("09:00", "22:00", "09:00", true)]
    [InlineData("09:00", "22:00", "22:00", false)]
    [InlineData("00:00", "00:00", "13:00", true)]
    public void CoversTimeOfDay_WrapsPastMidnight(string open, string close, string time, bool expected)
    {
        Assert.Equal(expected, ServiceWindowHelper.CoversTimeOfDay(
            TimeSpan.Parse(open), TimeSpan.Parse(close), TimeSpan.Parse(time)));
    }


    // ── Date exceptions ───────────────────────────────────────────────────────

    private const string ClosedSaturday = """[{"date":"2026-01-10","type":"closed"}]""";
    private const string SpecialSunday = """[{"date":"2026-01-11","type":"specialHours","open":"12:00","close":"16:00","lastBooking":"15:00"}]""";
    private const string WalkInSaturday = """[{"date":"2026-01-10","type":"walkInOnly"}]""";

    [Fact]
    public void ScheduleFor_ClosesAnOpenWeekdayOnAClosedDate()
    {
        Restaurant r = NewRestaurant(openDays: Saturday);
        r.DateExceptionsJson = ClosedSaturday;

        DaySchedule schedule = ServiceWindowHelper.ScheduleFor(r, new DateTime(2026, 1, 10));

        Assert.False(schedule.IsOpen);
        Assert.Equal(DateExceptionType.Closed, schedule.Exception);
        Assert.True(ServiceWindowHelper.IsOpenOn(r, new DateTime(2026, 1, 17)));
    }

    [Fact]
    public void ScheduleFor_OpensAClosedWeekdayWithSpecialHours()
    {
        // Sunday is not an open day, but the special-hours date opens it on its own hours.
        Restaurant r = NewRestaurant(openDays: Saturday);
        r.DateExceptionsJson = SpecialSunday;

        DaySchedule schedule = ServiceWindowHelper.ScheduleFor(r, new DateTime(2026, 1, 11));

        Assert.True(schedule.IsOpen);
        Assert.Equal(new TimeSpan(12, 0, 0), schedule.Open);
        Assert.Equal(new TimeSpan(16, 0, 0), schedule.Close);
        Assert.Equal("15:00", schedule.LastBooking);
        Assert.False(ServiceWindowHelper.IsOpenOn(r, new DateTime(2026, 1, 18)));
    }

    [Fact]
    public void ScheduleFor_KeepsTheWeeklyHoursOnAWalkInOnlyDate()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00", openDays: Saturday);
        r.DateExceptionsJson = WalkInSaturday;

        DaySchedule schedule = ServiceWindowHelper.ScheduleFor(r, new DateTime(2026, 1, 10));

        Assert.True(schedule.IsOpen);
        Assert.Equal(new TimeSpan(11, 0, 0), schedule.Open);
        Assert.Equal(DateExceptionType.WalkInOnly, schedule.Exception);
    }

    [Fact]
    public void ScheduleFor_DropsTheWeeklyLastBookingOnASpecialHoursDate()
    {
        // The weekly 21:00 cutoff was set for 09:00–22:00; it has no meaning inside 12:00–16:00.
        Restaurant r = NewRestaurant();
        r.LastBookingTime = "21:00";
        r.DateExceptionsJson = """[{"date":"2026-01-11","type":"specialHours","open":"12:00","close":"16:00"}]""";

        Assert.Null(ServiceWindowHelper.ScheduleFor(r, new DateTime(2026, 1, 11)).LastBooking);
        Assert.Equal("21:00", ServiceWindowHelper.ScheduleFor(r, new DateTime(2026, 1, 12)).LastBooking);
    }

    [Fact]
    public void IsServingAt_RejectsTheOvernightTailOfAClosedDate()
    {
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);
        r.DateExceptionsJson = ClosedSaturday;

        Assert.False(ServiceWindowHelper.IsServingAt(r, SaturdayAt(19)));
        Assert.False(ServiceWindowHelper.IsServingAt(r, SundayAt(0, 30)));
    }

    [Fact]
    public void IsAcceptingBookingsAt_UsesTheSpecialHoursCutoff()
    {
        Restaurant r = NewRestaurant(openDays: Saturday);
        r.DateExceptionsJson = SpecialSunday;

        Assert.True(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(15)));
        Assert.False(ServiceWindowHelper.IsAcceptingBookingsAt(r, SundayAt(15, 30)));
    }

    // ── End of service today ──────────────────────────────────────────────────

    [Fact]
    public void EndOfServiceToday_IsTodaysClose_BetweenOpeningAndClose()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");

        Assert.Equal(SaturdayAt(23), ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(14)));
    }

    [Fact]
    public void EndOfServiceToday_IsTodaysClose_BeforeTodaysService()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");

        Assert.Equal(SaturdayAt(23), ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(8)));
    }

    [Fact]
    public void EndOfServiceToday_IsNull_AfterTodaysService()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");

        Assert.Null(ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(23)));
        Assert.Null(ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(23, 30)));
    }

    [Fact]
    public void EndOfServiceToday_IsNull_OnAClosedDate()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");
        r.DateExceptionsJson = ClosedSaturday;

        Assert.Null(ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(14)));
    }

    [Fact]
    public void EndOfServiceToday_FollowsYesterdaysServicePastMidnight()
    {
        // Saturday runs 18:00–02:00. At 00:30 on Sunday that service is still the current one,
        // so the pause reaches its 02:00 close even though Sunday itself never opens.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00", openDays: Saturday);

        Assert.Equal(SundayAt(2), ServiceWindowHelper.EndOfServiceToday(r, SundayAt(0, 30)));
        Assert.Null(ServiceWindowHelper.EndOfServiceToday(r, SundayAt(3)));
    }

    [Fact]
    public void EndOfServiceToday_ResolvesTodayInTheRestaurantsOwnClock()
    {
        // 23:00 UTC on Saturday is 08:00 Sunday in Tokyo: Sunday's service is the one ahead.
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00", timezone: "Asia/Tokyo");

        DateTime? end = ServiceWindowHelper.EndOfServiceToday(r, SaturdayAt(23));

        Assert.Equal(new DateTime(2026, 1, 11, 14, 0, 0, DateTimeKind.Utc), end);
    }
}
