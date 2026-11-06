using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class OnlineBookingLimitsTests
{
    private static Restaurant NewRestaurant(
        int? maxDaysAhead = null,
        int? minNoticeMinutes = null,
        int? minParty = null,
        int? maxParty = null,
        string timezone = "UTC")
        => new()
        {
            Id = 1,
            Name = "T",
            Timezone = timezone,
            MaxBookingDaysAhead = maxDaysAhead,
            MinBookingNoticeMinutes = minNoticeMinutes,
            MinOnlinePartySize = minParty,
            MaxOnlinePartySize = maxParty,
        };

    private static readonly DateTime Now = new(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

    // ── Horizon ───────────────────────────────────────────────────────────────

    [Fact]
    public void IsBeyondHorizon_AllowsTheLastDayOfTheHorizon()
    {
        Restaurant r = NewRestaurant(maxDaysAhead: 14);

        Assert.False(OnlineBookingLimits.IsBeyondHorizon(r, Now.AddDays(14).AddHours(10), Now));
    }

    [Fact]
    public void IsBeyondHorizon_RefusesTheDayAfterTheHorizon()
    {
        Restaurant r = NewRestaurant(maxDaysAhead: 14);

        Assert.True(OnlineBookingLimits.IsBeyondHorizon(r, Now.AddDays(15).AddHours(-11), Now));
    }

    [Fact]
    public void IsBeyondHorizon_CountsCalendarDaysInTheRestaurantsOwnClock()
    {
        // 23:30 UTC is already tomorrow in Tokyo, so a horizon of 0 reaches Tokyo's whole tomorrow
        // and not the UTC date the instant falls on.
        Restaurant r = NewRestaurant(maxDaysAhead: 0, timezone: "Asia/Tokyo");
        var lateUtc = new DateTime(2026, 3, 10, 23, 30, 0, DateTimeKind.Utc);

        Assert.False(OnlineBookingLimits.IsBeyondHorizon(r, new DateTime(2026, 3, 11, 10, 0, 0, DateTimeKind.Utc), lateUtc));
        Assert.True(OnlineBookingLimits.IsBeyondHorizon(r, new DateTime(2026, 3, 11, 16, 0, 0, DateTimeKind.Utc), lateUtc));
    }

    [Fact]
    public void IsBeyondHorizon_IsFalseWithoutAHorizon()
    {
        Assert.False(OnlineBookingLimits.IsBeyondHorizon(NewRestaurant(), Now.AddYears(5), Now));
    }

    // ── Notice ────────────────────────────────────────────────────────────────

    [Fact]
    public void IsInsideNotice_AllowsASittingExactlyTheNoticeAway()
    {
        Restaurant r = NewRestaurant(minNoticeMinutes: 120);

        Assert.False(OnlineBookingLimits.IsInsideNotice(r, Now.AddMinutes(120), Now));
    }

    [Fact]
    public void IsInsideNotice_RefusesASittingAMinuteShortOfTheNotice()
    {
        Restaurant r = NewRestaurant(minNoticeMinutes: 120);

        Assert.True(OnlineBookingLimits.IsInsideNotice(r, Now.AddMinutes(119), Now));
    }

    [Fact]
    public void IsInsideNotice_IsFalseWithoutANotice()
    {
        Assert.False(OnlineBookingLimits.IsInsideNotice(NewRestaurant(), Now.AddMinutes(1), Now));
    }

    // ── Party size ────────────────────────────────────────────────────────────

    [Fact]
    public void AcceptsPartySize_AllowsBothBoundsInclusive()
    {
        Restaurant r = NewRestaurant(minParty: 2, maxParty: 8);

        Assert.True(OnlineBookingLimits.AcceptsPartySize(r, 2));
        Assert.True(OnlineBookingLimits.AcceptsPartySize(r, 8));
    }

    [Fact]
    public void AcceptsPartySize_RefusesOneOutsideEitherBound()
    {
        Restaurant r = NewRestaurant(minParty: 2, maxParty: 8);

        Assert.False(OnlineBookingLimits.AcceptsPartySize(r, 1));
        Assert.False(OnlineBookingLimits.AcceptsPartySize(r, 9));
    }

    [Fact]
    public void AcceptsPartySize_TakesAnyPartyWithoutLimits()
    {
        Assert.True(OnlineBookingLimits.AcceptsPartySize(NewRestaurant(), 1));
        Assert.True(OnlineBookingLimits.AcceptsPartySize(NewRestaurant(), 40));
    }
}
