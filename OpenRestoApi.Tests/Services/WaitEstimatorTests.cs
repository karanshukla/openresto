using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class WaitEstimatorTests
{
    private static readonly DateTime Now = new(2026, 9, 26, 19, 0, 0, DateTimeKind.Utc);

    /// <summary>A two-top (id 1) and a four-top (id 2), 60-minute sittings.</summary>
    private static Restaurant Floor(int? oversizeCap = null)
    {
        var restaurant = new Restaurant { Id = 1, Name = "R", DefaultBookingDurationMinutes = 60, MaxTableOversizeSeats = oversizeCap };
        restaurant.Sections.Add(new Section
        {
            Id = 1,
            Name = "Main",
            RestaurantId = 1,
            Tables = new List<Table>
            {
                new() { Id = 1, Seats = 2, SectionId = 1 },
                new() { Id = 2, Seats = 4, SectionId = 1 },
            },
        });
        return restaurant;
    }

    private static IReadOnlyList<DateTime?> Estimate(Restaurant r, int[] parties, Dictionary<int, DateTime>? freeAt = null)
        => WaitEstimator.EstimateSeatingTimes(r, parties, freeAt ?? new Dictionary<int, DateTime>(), Now);

    [Fact]
    public void Estimate_SeatsAtOnce_WhenAFittingTableIsFree()
    {
        Assert.Equal(Now, Estimate(Floor(), [2])[0]);
    }

    [Fact]
    public void Estimate_WaitsForTheSittingThatEndsFirst()
    {
        var freeAt = new Dictionary<int, DateTime> { [1] = Now.AddMinutes(40), [2] = Now.AddMinutes(15) };

        Assert.Equal(Now.AddMinutes(15), Estimate(Floor(), [2], freeAt)[0]);
    }

    [Fact]
    public void Estimate_QueuesASecondPartyBehindTheFirst()
    {
        var freeAt = new Dictionary<int, DateTime> { [1] = Now.AddMinutes(30) };

        IReadOnlyList<DateTime?> seats = Estimate(Floor(), [4, 4], freeAt);

        Assert.Equal(Now, seats[0]);
        Assert.Equal(Now.AddMinutes(60), seats[1]);
    }

    [Fact]
    public void Estimate_LetsASmallPartyOvertakeALargeOne()
    {
        var freeAt = new Dictionary<int, DateTime> { [1] = Now.AddMinutes(10), [2] = Now.AddMinutes(45) };

        IReadOnlyList<DateTime?> seats = Estimate(Floor(), [4, 2], freeAt);

        Assert.Equal(Now.AddMinutes(45), seats[0]);
        Assert.Equal(Now.AddMinutes(10), seats[1]);
    }

    [Fact]
    public void Estimate_PrefersTheSmallerTable_WhenBothAreFree()
    {
        IReadOnlyList<DateTime?> seats = Estimate(Floor(), [2, 4]);

        Assert.Equal(Now, seats[0]);
        Assert.Equal(Now, seats[1]);
    }

    [Fact]
    public void Estimate_IsNull_ForAPartyNothingCanSeat()
    {
        Assert.Null(Estimate(Floor(), [5])[0]);
    }

    [Fact]
    public void Estimate_UsesAGroup_OnlyOnceAllItsMembersAreFree()
    {
        Restaurant r = Floor();
        r.Groups.Add(new TableGroup
        {
            Id = 9,
            CombinedSeats = 6,
            Members = new List<TableGroupMembership> { new() { TableGroupId = 9, TableId = 1 }, new() { TableGroupId = 9, TableId = 2 } },
        });
        var freeAt = new Dictionary<int, DateTime> { [1] = Now.AddMinutes(20), [2] = Now.AddMinutes(50) };

        Assert.Equal(Now.AddMinutes(50), Estimate(r, [6], freeAt)[0]);
    }

    [Fact]
    public void Estimate_RespectsTheOversizeCap()
    {
        var freeAt = new Dictionary<int, DateTime> { [1] = Now.AddMinutes(30) };

        Assert.Equal(Now, Estimate(Floor(oversizeCap: 3), [1], freeAt)[0]);
        Assert.Equal(Now.AddMinutes(30), Estimate(Floor(oversizeCap: 2), [1], freeAt)[0]);
    }

    [Fact]
    public void TableFreeTimes_CountsAGroupSittingAgainstEveryMember()
    {
        Restaurant r = Floor();
        r.Groups.Add(new TableGroup
        {
            Id = 9,
            CombinedSeats = 6,
            Members = new List<TableGroupMembership> { new() { TableGroupId = 9, TableId = 1 }, new() { TableGroupId = 9, TableId = 2 } },
        });
        var booking = new Booking { TableGroupId = 9, Date = Now.AddMinutes(-30), EndTime = Now.AddMinutes(30) };

        Dictionary<int, DateTime> freeAt = WaitEstimator.TableFreeTimes(r, [booking]);

        Assert.Equal(Now.AddMinutes(30), freeAt[1]);
        Assert.Equal(Now.AddMinutes(30), freeAt[2]);
    }

    [Fact]
    public void TableFreeTimes_FallsBackToTheDefaultSitting_WithoutAnEndTime()
    {
        var booking = new Booking { TableId = 1, Date = Now.AddMinutes(-20) };

        Assert.Equal(Now.AddMinutes(40), WaitEstimator.TableFreeTimes(Floor(), [booking])[1]);
    }

    [Fact]
    public void TableFreeTimes_KeepsTheLatestEnd_WhenSittingsOverlapOnATable()
    {
        Booking[] bookings =
        [
            new() { TableId = 1, Date = Now.AddMinutes(-50), EndTime = Now.AddMinutes(40) },
            new() { TableId = 1, Date = Now.AddMinutes(-10), EndTime = Now.AddMinutes(10) },
        ];

        Assert.Equal(Now.AddMinutes(40), WaitEstimator.TableFreeTimes(Floor(), bookings)[1]);
    }

    [Fact]
    public void TableFreeTimes_IgnoresAGroupBookingForAGroupThatNoLongerExists()
    {
        var booking = new Booking { TableGroupId = 42, Date = Now, EndTime = Now.AddMinutes(60) };

        Assert.Empty(WaitEstimator.TableFreeTimes(Floor(), [booking]));
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(-5, 0)]
    [InlineData(0.5, 1)]
    [InlineData(12, 12)]
    public void MinutesUntil_RoundsUp_AndNeverGoesNegative(double minutesAhead, int expected)
    {
        Assert.Equal(expected, WaitEstimator.MinutesUntil(Now.AddMinutes(minutesAhead), Now));
    }

    [Fact]
    public void MinutesUntil_IsNull_WithoutAnEstimate()
    {
        Assert.Null(WaitEstimator.MinutesUntil(null, Now));
    }
}
