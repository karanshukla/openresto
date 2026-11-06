using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class BookingLimitsHelperTests
{
    private static readonly DateTime Now = new(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

    private static Restaurant NewRestaurant(
        int? maxDaysAhead = null,
        int? minNoticeMinutes = null,
        int? minParty = null,
        int? maxParty = null)
        => new()
        {
            Id = 1,
            Name = "T",
            Timezone = "UTC",
            MaxBookingDaysAhead = maxDaysAhead,
            MinBookingNoticeMinutes = minNoticeMinutes,
            MinOnlinePartySize = minParty,
            MaxOnlinePartySize = maxParty,
        };

    // ── RejectionFor ──────────────────────────────────────────────────────────

    [Fact]
    public void RejectionFor_IsNullInsideEveryLimit()
    {
        Restaurant r = NewRestaurant(maxDaysAhead: 7, minNoticeMinutes: 60, minParty: 2, maxParty: 6);

        Assert.Null(BookingLimitsHelper.RejectionFor(r, Now.AddDays(7), seats: 4, Now));
    }

    [Fact]
    public void RejectionFor_NamesTheHorizonForADayPastIt()
    {
        Restaurant r = NewRestaurant(maxDaysAhead: 7);

        BookingLimitsHelper.Rejection? rejection = BookingLimitsHelper.RejectionFor(r, Now.AddDays(8), seats: 2, Now);

        Assert.Equal(ErrorCodes.BookingBeyondHorizon, rejection!.Value.Code);
        Assert.Equal(7, rejection.Value.Args!["days"]);
        Assert.Contains("7 days", rejection.Value.Message);
    }

    [Fact]
    public void RejectionFor_NamesTheNoticeForASittingTooSoon()
    {
        Restaurant r = NewRestaurant(minNoticeMinutes: 90);

        BookingLimitsHelper.Rejection? rejection = BookingLimitsHelper.RejectionFor(r, Now.AddMinutes(30), seats: 2, Now);

        Assert.Equal(ErrorCodes.BookingTooSoon, rejection!.Value.Code);
        Assert.Equal(90, rejection.Value.Args!["minutes"]);
    }

    [Fact]
    public void RejectionFor_NamesTheMinimumForAPartyUnderIt()
    {
        Restaurant r = NewRestaurant(minParty: 2);

        BookingLimitsHelper.Rejection? rejection = BookingLimitsHelper.RejectionFor(r, Now.AddDays(1), seats: 1, Now);

        Assert.Equal(ErrorCodes.BookingPartyBelowOnlineMin, rejection!.Value.Code);
        Assert.Equal(2, rejection.Value.Args!["min"]);
    }

    [Fact]
    public void RejectionFor_NamesTheMaximumForAPartyOverIt()
    {
        Restaurant r = NewRestaurant(maxParty: 8);

        BookingLimitsHelper.Rejection? rejection = BookingLimitsHelper.RejectionFor(r, Now.AddDays(1), seats: 9, Now);

        Assert.Equal(ErrorCodes.BookingPartyAboveOnlineMax, rejection!.Value.Code);
        Assert.Equal(8, rejection.Value.Args!["max"]);
    }

    // ── Apply ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Apply_StoresEveryLimit()
    {
        Restaurant r = NewRestaurant();

        BookingLimitsHelper.Apply(r, maxDaysAhead: 30, minNoticeMinutes: 120, minPartySize: 2, maxPartySize: 10);

        Assert.Equal(30, r.MaxBookingDaysAhead);
        Assert.Equal(120, r.MinBookingNoticeMinutes);
        Assert.Equal(2, r.MinOnlinePartySize);
        Assert.Equal(10, r.MaxOnlinePartySize);
    }

    [Fact]
    public void Apply_ClearsALimitSentAsNull()
    {
        Restaurant r = NewRestaurant(maxDaysAhead: 30, minNoticeMinutes: 120, minParty: 2, maxParty: 10);

        BookingLimitsHelper.Apply(r, null, null, null, null);

        Assert.Null(r.MaxBookingDaysAhead);
        Assert.Null(r.MinBookingNoticeMinutes);
        Assert.Null(r.MinOnlinePartySize);
        Assert.Null(r.MaxOnlinePartySize);
    }

    [Fact]
    public void Apply_AcceptsAHorizonOfZeroDays()
    {
        Restaurant r = NewRestaurant();

        BookingLimitsHelper.Apply(r, maxDaysAhead: 0, null, null, null);

        Assert.Equal(0, r.MaxBookingDaysAhead);
    }

    [Fact]
    public void Apply_RejectsANegativeHorizon()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => BookingLimitsHelper.Apply(NewRestaurant(), maxDaysAhead: -1, null, null, null));

        Assert.Equal(ErrorCodes.RestaurantBookingHorizonInvalid, ex.Code);
    }

    [Fact]
    public void Apply_RejectsAHorizonPastAYear()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => BookingLimitsHelper.Apply(NewRestaurant(), maxDaysAhead: BookingLimitsHelper.MaxHorizonDays + 1, null, null, null));

        Assert.Equal(ErrorCodes.RestaurantBookingHorizonInvalid, ex.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(BookingLimitsHelper.MaxNoticeMinutes + 1)]
    public void Apply_RejectsANoticeOutsideItsRange(int minutes)
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => BookingLimitsHelper.Apply(NewRestaurant(), null, minNoticeMinutes: minutes, null, null));

        Assert.Equal(ErrorCodes.RestaurantBookingNoticeInvalid, ex.Code);
    }

    [Fact]
    public void Apply_AcceptsAMaximumEqualToTheMinimum()
    {
        Restaurant r = NewRestaurant();

        BookingLimitsHelper.Apply(r, null, null, minPartySize: 4, maxPartySize: 4);

        Assert.Equal(4, r.MaxOnlinePartySize);
    }

    [Fact]
    public void Apply_RejectsAMaximumBelowTheMinimum()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => BookingLimitsHelper.Apply(NewRestaurant(), null, null, minPartySize: 4, maxPartySize: 3));

        Assert.Equal(ErrorCodes.RestaurantOnlinePartySizeInvalid, ex.Code);
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(null, BookingLimits.MaxSeats + 1)]
    public void Apply_RejectsAPartySizeOutsideTheGlobalBounds(int? min, int? max)
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => BookingLimitsHelper.Apply(NewRestaurant(), null, null, minPartySize: min, maxPartySize: max));

        Assert.Equal(ErrorCodes.RestaurantOnlinePartySizeInvalid, ex.Code);
    }
}
