using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Guard-clause and degenerate-shape branches of <see cref="TableAutoAssigner.BuildCandidatesAsync"/>.
/// These build the restaurant graph in memory rather than through EF so the null/empty navigation
/// shapes an EF Include can't produce (a section with no Tables collection, a membership whose Table
/// was never loaded) are reachable at all.
/// </summary>
public class TableAutoAssignerEdgeCaseTests
{
    private readonly Mock<IBookingRepository> _bookingRepository = new();
    private readonly Mock<IHoldService> _holdService = new();

    private TableAutoAssigner CreateAssigner() => new(_bookingRepository.Object, _holdService.Object);

    private static readonly DateTime BookingDate = DateTime.UtcNow.AddDays(1);

    [Fact]
    public async Task BuildCandidates_ReturnsEmpty_WhenTheRestaurantHasNoSectionsCollection()
    {
        var restaurant = new Restaurant { Id = 1, Sections = null! };

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, 2, BookingDate));
    }

    [Fact]
    public async Task BuildCandidates_ReturnsEmpty_WhenTheRestaurantHasNoSections()
    {
        var restaurant = new Restaurant { Id = 1, Sections = [] };

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, 2, BookingDate));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-2)]
    public async Task BuildCandidates_ReturnsEmpty_WhenSeatsIsNotPositive(int seats)
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Sections = [new Section { Id = 1, Tables = [new Table { Id = 1, SectionId = 1, Seats = 4 }] }]
        };

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, seats, BookingDate));
    }

    [Fact]
    public async Task BuildCandidates_SkipsSectionsWithoutATablesCollection()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Sections =
            [
                new Section { Id = 1, Tables = null! },
                new Section { Id = 2, Tables = [new Table { Id = 5, SectionId = 2, Seats = 4 }] }
            ]
        };

        IReadOnlyList<TableCandidate> candidates =
            await CreateAssigner().BuildCandidatesAsync(restaurant, 2, BookingDate);

        TableCandidate only = Assert.Single(candidates);
        Assert.Equal(5, only.TableId);
        Assert.Equal(2, only.SectionId);
    }

    [Fact]
    public async Task BuildCandidates_SkipsGroupsWithNoMembers()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Sections = [new Section { Id = 1, Tables = [] }],
            Groups = [new TableGroup { Id = 1, RestaurantId = 1, CombinedSeats = 8 }]
        };

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, 6, BookingDate));
    }

    [Fact]
    public async Task BuildCandidates_SkipsGroupsSmallerThanTheParty()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Sections = [new Section { Id = 1, Tables = [] }],
            Groups = [GroupOf(combinedSeats: 4, (1, 1), (2, 1))]
        };

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, 6, BookingDate));
    }

    [Fact]
    public async Task BuildCandidates_AnchorsGroupSectionToZero_WhenTheLowestMemberTableIsNotLoaded()
    {
        var group = new TableGroup { Id = 1, RestaurantId = 1, CombinedSeats = 8 };
        group.Members.Add(new TableGroupMembership { TableGroupId = 1, TableId = 2, Table = null });
        group.Members.Add(new TableGroupMembership
        {
            TableGroupId = 1,
            TableId = 9,
            Table = new Table { Id = 9, SectionId = 3, Seats = 4 }
        });

        var restaurant = new Restaurant { Id = 1, Sections = [new Section { Id = 1, Tables = [] }], Groups = [group] };

        TableCandidate only = Assert.Single(await CreateAssigner().BuildCandidatesAsync(restaurant, 6, BookingDate));
        Assert.True(only.IsGroup);
        Assert.Equal(2, only.TableId);
        Assert.Equal(0, only.SectionId);
        Assert.Equal(new[] { 2, 9 }, only.Members);
    }

    [Fact]
    public async Task BuildCandidates_ExcludesGroup_WhenTheGroupItselfIsAlreadyBooked()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Sections = [new Section { Id = 1, Tables = [] }],
            Groups = [GroupOf(combinedSeats: 8, (1, 1), (2, 1))]
        };
        _bookingRepository
            .Setup(r => r.IsUnitBookedOnDateAsync(null, 1, It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(true);

        Assert.Empty(await CreateAssigner().BuildCandidatesAsync(restaurant, 6, BookingDate));
        // The per-member hold check is short-circuited once the group is known to be booked.
        _holdService.Verify(
            s => s.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task BuildCandidates_AppliesTheOversizeCapToStandaloneTables()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            MaxTableOversizeSeats = 1,
            Sections =
            [
                new Section
                {
                    Id = 1,
                    Tables =
                    [
                        new Table { Id = 1, SectionId = 1, Seats = 3 },
                        new Table { Id = 2, SectionId = 1, Seats = 8 }
                    ]
                }
            ]
        };

        TableCandidate only = Assert.Single(await CreateAssigner().BuildCandidatesAsync(restaurant, 2, BookingDate));
        Assert.Equal(1, only.TableId);
    }

    private static TableGroup GroupOf(int combinedSeats, params (int TableId, int SectionId)[] members)
    {
        var group = new TableGroup { Id = 1, RestaurantId = 1, CombinedSeats = combinedSeats };
        foreach ((int tableId, int sectionId) in members)
        {
            group.Members.Add(new TableGroupMembership
            {
                TableGroupId = 1,
                TableId = tableId,
                Table = new Table { Id = tableId, SectionId = sectionId, Seats = 4 }
            });
        }
        return group;
    }
}
