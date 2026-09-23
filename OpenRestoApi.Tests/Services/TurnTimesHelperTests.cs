using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class TurnTimesHelperTests
{
    private static TurnTimeDto Rule(int minSeats, int minutes) => new() { MinSeats = minSeats, Minutes = minutes };

    [Fact]
    public void Apply_StoresTheRules_OrderedByPartySize()
    {
        var restaurant = new Restaurant();

        TurnTimesHelper.Apply(restaurant, [Rule(5, 120), Rule(1, 60)]);

        Assert.Equal("""[{"minSeats":1,"minutes":60},{"minSeats":5,"minutes":120}]""", restaurant.TurnTimesJson);
    }

    [Fact]
    public void Apply_ClearsTheRules_GivenAnEmptyList()
    {
        var restaurant = new Restaurant { TurnTimesJson = """[{"minSeats":1,"minutes":60}]""" };

        TurnTimesHelper.Apply(restaurant, []);

        Assert.Null(restaurant.TurnTimesJson);
    }

    [Fact]
    public void Apply_Accepts_MinutesFromTheAllowedDurations()
    {
        var restaurant = new Restaurant();

        TurnTimesHelper.Apply(restaurant, [Rule(1, 480)]);

        Assert.NotNull(restaurant.TurnTimesJson);
    }

    [Fact]
    public void Apply_Rejects_MinutesOutsideTheAllowedDurations()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => TurnTimesHelper.Apply(new Restaurant(), [Rule(1, 75)]));

        Assert.Equal(ErrorCodes.RestaurantTurnTimeMinutesInvalid, ex.Code);
    }

    [Fact]
    public void Apply_Accepts_APartySizeAtTheBookingLimit()
    {
        var restaurant = new Restaurant();

        TurnTimesHelper.Apply(restaurant, [Rule(BookingLimits.MaxSeats, 120)]);

        Assert.NotNull(restaurant.TurnTimesJson);
    }

    [Fact]
    public void Apply_Rejects_APartySizeAboveTheBookingLimit()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => TurnTimesHelper.Apply(new Restaurant(), [Rule(BookingLimits.MaxSeats + 1, 120)]));

        Assert.Equal(ErrorCodes.RestaurantTurnTimeSeatsOutOfRange, ex.Code);
    }

    [Fact]
    public void Apply_Rejects_APartySizeOfZero()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => TurnTimesHelper.Apply(new Restaurant(), [Rule(0, 60)]));

        Assert.Equal(ErrorCodes.RestaurantTurnTimeSeatsOutOfRange, ex.Code);
    }

    [Fact]
    public void Apply_Rejects_TwoRulesForTheSamePartySize()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => TurnTimesHelper.Apply(new Restaurant(), [Rule(3, 90), Rule(3, 120)]));

        Assert.Equal(ErrorCodes.RestaurantTurnTimeDuplicateSeats, ex.Code);
    }

    [Fact]
    public void Parse_ReturnsNoRules_ForUnreadableJson()
    {
        Assert.Empty(TurnTimesHelper.Parse("{not json"));
    }
}
