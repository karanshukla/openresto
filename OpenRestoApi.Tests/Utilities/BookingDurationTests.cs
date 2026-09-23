using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Utilities;

public class BookingDurationTests
{
    private static readonly DateTime Start = new(2026, 8, 23, 18, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ResolveEnd_UsesStoredEndTime()
    {
        DateTime stored = Start.AddMinutes(150);

        Assert.Equal(stored, BookingDuration.ResolveEnd(Start, stored, 90));
    }

    [Fact]
    public void ResolveEnd_FallsBackToRestaurantDefaultWhenNull()
    {
        Assert.Equal(Start.AddMinutes(90), BookingDuration.ResolveEnd(Start, null, 90));
    }

    [Fact]
    public void ResolveEnd_FallsBackWhenStoredEndIsNotAfterStart()
    {
        Assert.Equal(Start.AddMinutes(90), BookingDuration.ResolveEnd(Start, Start, 90));
    }

    [Fact]
    public void ResolveEnd_UsesFallbackMinutesWhenLocationHasNoDefault()
    {
        Assert.Equal(
            Start.AddMinutes(BookingDuration.FallbackMinutes),
            BookingDuration.ResolveEnd(Start, null, null));
    }

    private static Restaurant WithTurnTimes() => new()
    {
        DefaultBookingDurationMinutes = 45,
        TurnTimesJson = """[{"minSeats":1,"minutes":60},{"minSeats":3,"minutes":90},{"minSeats":5,"minutes":120}]""",
    };

    [Fact]
    public void For_UsesTheRuleForTheLargerParty_AtItsBoundary()
    {
        Assert.Equal(90, BookingDuration.For(WithTurnTimes(), 3));
    }

    [Fact]
    public void For_KeepsTheSmallerRule_OneSeatBelowTheBoundary()
    {
        Assert.Equal(60, BookingDuration.For(WithTurnTimes(), 2));
    }

    [Fact]
    public void For_UsesTheLargestRule_ForAnyBiggerParty()
    {
        Assert.Equal(120, BookingDuration.For(WithTurnTimes(), 12));
    }

    [Fact]
    public void For_UsesTheDefault_BelowTheLowestRule()
    {
        var restaurant = new Restaurant
        {
            DefaultBookingDurationMinutes = 60,
            TurnTimesJson = """[{"minSeats":6,"minutes":150}]""",
        };

        Assert.Equal(60, BookingDuration.For(restaurant, 5));
    }

    [Fact]
    public void For_UsesTheDefault_WithoutRules()
    {
        Assert.Equal(75, BookingDuration.For(new Restaurant { DefaultBookingDurationMinutes = 75 }, 8));
    }
}
