using OpenRestoApi.Core.Application.Services;
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

        Assert.True(ServiceWindowHelper.IsOpenOn(r, 1));
        Assert.True(ServiceWindowHelper.IsOpenOn(r, 7));
    }

    [Fact]
    public void IsOpenOn_RejectsADayTheListOmits()
    {
        Restaurant r = NewRestaurant(openDays: Saturday);

        Assert.True(ServiceWindowHelper.IsOpenOn(r, 6));
        Assert.False(ServiceWindowHelper.IsOpenOn(r, 7));
    }

    // ── LocalWindowFor ────────────────────────────────────────────────────────

    [Fact]
    public void LocalWindowFor_KeepsASameDayWindowOnItsOwnDate()
    {
        Restaurant r = NewRestaurant(openTime: "11:00", closeTime: "23:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate, 6);

        Assert.Equal(new DateTime(2026, 1, 10, 11, 0, 0), start);
        Assert.Equal(new DateTime(2026, 1, 10, 23, 0, 0), end);
    }

    [Fact]
    public void LocalWindowFor_RollsAWrappingWindowIntoTheFollowingDay()
    {
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate, 6);

        Assert.Equal(new DateTime(2026, 1, 10, 18, 0, 0), start);
        Assert.Equal(new DateTime(2026, 1, 11, 2, 0, 0), end);
    }

    [Fact]
    public void LocalWindowFor_SpansAFullDay_WhenOpenEqualsClose()
    {
        Restaurant r = NewRestaurant(openTime: "00:00", closeTime: "00:00");
        var localDate = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Unspecified);

        (DateTime start, DateTime end) = ServiceWindowHelper.LocalWindowFor(r, localDate, 6);

        Assert.Equal(TimeSpan.FromDays(1), end - start);
    }
}
