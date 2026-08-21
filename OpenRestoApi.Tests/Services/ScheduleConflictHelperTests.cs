using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class ScheduleConflictHelperTests
{
    private static Restaurant Restaurant(
        string openTime = "11:00",
        string closeTime = "23:00",
        string openDays = "1,2,3,4,5,6,7",
        string? openHoursJson = null,
        bool walkInOnly = false,
        string? walkInDays = null) => new()
        {
            Id = 1,
            Name = "R",
            Timezone = "UTC",
            OpenTime = openTime,
            CloseTime = closeTime,
            OpenDays = openDays,
            OpenHoursJson = openHoursJson,
            WalkInOnly = walkInOnly,
            WalkInDays = walkInDays,
        };

    // 2026-08-24 is a Monday, so the ISO day of each instant below is unambiguous.
    private static DateTime MondayAt(int hour, int minute = 0)
        => new(2026, 8, 24, hour, minute, 0, DateTimeKind.Utc);

    [Fact]
    public void Evaluate_KeepsSittingInsideTheCurrentWindow()
    {
        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(Restaurant(), MondayAt(19)));
    }

    [Fact]
    public void Evaluate_FlagsSittingBeforeTheNarrowedOpeningTime()
    {
        Assert.Equal(
            ScheduleConflictReason.OutsideHours,
            ScheduleConflictHelper.Evaluate(Restaurant(openTime: "17:00"), MondayAt(12)));
    }

    [Fact]
    public void Evaluate_KeepsSittingAtTheOpeningTimeItself()
    {
        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(Restaurant(openTime: "17:00"), MondayAt(17)));
    }

    [Fact]
    public void Evaluate_FlagsSittingAtTheNewClosingTime()
    {
        Assert.Equal(
            ScheduleConflictReason.OutsideHours,
            ScheduleConflictHelper.Evaluate(Restaurant(closeTime: "21:00"), MondayAt(21)));
    }

    [Fact]
    public void Evaluate_KeepsSittingJustBeforeTheNewClosingTime()
    {
        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(Restaurant(closeTime: "21:00"), MondayAt(20, 59)));
    }

    [Fact]
    public void Evaluate_FlagsSittingOnADayThatIsNoLongerOpen()
    {
        Assert.Equal(
            ScheduleConflictReason.ClosedDay,
            ScheduleConflictHelper.Evaluate(Restaurant(openDays: "2,3,4,5,6,7"), MondayAt(19)));
    }

    [Fact]
    public void Evaluate_FlagsSittingAgainstThePerDayOverrideRatherThanTheUniformHours()
    {
        // Monday closes at 20:00 through the override; the uniform CloseTime would still allow 21:00.
        Restaurant restaurant = Restaurant(openHoursJson: """{"1":{"open":"11:00","close":"20:00"}}""");

        Assert.Equal(
            ScheduleConflictReason.OutsideHours,
            ScheduleConflictHelper.Evaluate(restaurant, MondayAt(21)));
    }

    [Fact]
    public void Evaluate_KeepsAfterMidnightSittingOfAnOvernightService()
    {
        // Sunday runs 18:00–02:00, so a 00:30 sitting belongs to Sunday's service even though
        // it lands on Monday. AvailabilityService sells that slot; flagging it would be a false
        // positive on every late-night venue.
        Restaurant restaurant = Restaurant(openTime: "18:00", closeTime: "02:00");

        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(restaurant, MondayAt(0, 30)));
    }

    [Fact]
    public void Evaluate_FlagsAfterMidnightSittingWhenThePreviousDayIsClosed()
    {
        // Same overnight window, but Sunday is no longer an open day — nothing serves 00:30 now.
        Restaurant restaurant = Restaurant(openTime: "18:00", closeTime: "02:00", openDays: "1,2,3,4,5,6");

        Assert.Equal(
            ScheduleConflictReason.OutsideHours,
            ScheduleConflictHelper.Evaluate(restaurant, MondayAt(0, 30)));
    }

    [Fact]
    public void Evaluate_FlagsSittingOnceTheLocationTurnsWalkInOnly()
    {
        Assert.Equal(
            ScheduleConflictReason.WalkInOnly,
            ScheduleConflictHelper.Evaluate(Restaurant(walkInOnly: true), MondayAt(19)));
    }

    [Fact]
    public void Evaluate_FlagsSittingOnADayTurnedWalkInOnly()
    {
        Assert.Equal(
            ScheduleConflictReason.WalkInOnly,
            ScheduleConflictHelper.Evaluate(Restaurant(walkInDays: "1"), MondayAt(19)));
    }

    [Fact]
    public void Evaluate_KeepsSittingOnADayOtherLocationDaysTurnedWalkInOnly()
    {
        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(Restaurant(walkInDays: "2,3"), MondayAt(19)));
    }

    [Fact]
    public void Evaluate_ReportsTheClosedDayRatherThanTheWalkInSwitchWhenBothApply()
    {
        // A closed day is the harder problem: the guest has nowhere to be seated at all, where a
        // walk-in day still opens. Reporting the milder reason would understate the fix needed.
        Restaurant restaurant = Restaurant(openDays: "2,3,4,5,6,7", walkInOnly: true);

        Assert.Equal(
            ScheduleConflictReason.ClosedDay,
            ScheduleConflictHelper.Evaluate(restaurant, MondayAt(19)));
    }

    [Fact]
    public void Evaluate_ResolvesTheSittingInTheLocationTimezone()
    {
        // 02:00 UTC is 21:00 the previous day in New York — inside an 11:00–23:00 service.
        // Reading the instant as UTC would place it before opening and flag it.
        Restaurant restaurant = Restaurant();
        restaurant.Timezone = "America/New_York";

        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(restaurant, MondayAt(2)));
    }

    [Fact]
    public void Evaluate_KeepsEverySittingWhenOpenAndCloseMatch()
    {
        Assert.Equal(
            ScheduleConflictReason.None,
            ScheduleConflictHelper.Evaluate(Restaurant(openTime: "00:00", closeTime: "00:00"), MondayAt(4)));
    }
}
