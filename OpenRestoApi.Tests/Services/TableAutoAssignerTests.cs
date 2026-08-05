using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class TableAutoAssignerTests
{
    private sealed class UtcClock : ISystemClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    /// <summary>
    /// Seeds a restaurant with two standalone 4-seat tables (T1, T2) and a combinable group made of
    /// two 4-seat tables (T3, T4) with CombinedSeats 8. Used to exercise the deprioritization +
    /// group-candidate logic.
    /// </summary>
    private static (Restaurant, AppDbContext) SeedWithGroup(string name)
    {
        AppDbContext db = TestDbFactory.Create(name);
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Group Bistro", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC"
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 3, Name = "T3", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 4, Name = "T4", Seats = 4, SectionId = 1 });
        db.TableGroups.Add(new TableGroup
        {
            Id = 1, RestaurantId = 1, CombinedSeats = 8,
            Members = new List<TableGroupMembership>
            {
                new() { TableGroupId = 1, TableId = 3 },
                new() { TableGroupId = 1, TableId = 4 }
            }
        });
        db.SaveChanges();

        // Re-fetch the restaurant with its full graph (Sections → Tables + Groups → Members → Table)
        // so the assigner can walk restaurant.Sections and restaurant.Groups. Memberships' .Table nav
        // is populated by the Include (left null during seeding to avoid duplicate-tracking).
        Restaurant? loaded = db.Restaurants
            .Include(r => r.Sections).ThenInclude(s => s.Tables)
            .Include(r => r.Groups).ThenInclude(g => g.Members).ThenInclude(m => m.Table)
            .First();
        return (loaded, db);
    }

    private static TableAutoAssigner CreateAssigner(AppDbContext db, IHoldService? holdService = null)
    {
        holdService ??= new HoldService(new UtcClock());
        return new TableAutoAssigner(new BookingRepository(db), holdService);
    }

    [Fact]
    public async Task BuildCandidates_DeprioritizesGroups_AgainstStandaloneTablesOfEqualCapacity()
    {
        // Party of 4: both standalone tables (T1, T2) and the group (CombinedSeats 8) fit. The
        // group has a larger capacity (8 > 4) so it sorts after by Seats already; but the key
        // deprioritization rule is IsGroup as a tiebreaker — assert standalone tables come first.
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_DeprioritizesGroups_AgainstStandaloneTablesOfEqualCapacity));
        using (db)
        {
            TableAutoAssigner assigner = CreateAssigner(db);

            IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 4, DateTime.UtcNow.AddDays(10));

            // Standalone tables first, then the group. No standalone table should appear after a group.
            int firstGroupIndex = candidates.TakeWhile(c => !c.IsGroup).Count();
            Assert.True(firstGroupIndex >= 2); // at least the two standalone tables precede any group
            Assert.Contains(candidates, c => c.IsGroup && c.TableGroupId == 1);
        }
    }

    [Fact]
    public async Task BuildCandidates_PrefersStandaloneTable_WhenPartyFitsBoth()
    {
        // Party of 4 fits both a standalone table and the group; the first candidate must be a
        // standalone table (deprioritization — combinable tables fill last).
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_PrefersStandaloneTable_WhenPartyFitsBoth));
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 4, DateTime.UtcNow.AddDays(11));

        Assert.NotEmpty(candidates);
        Assert.False(candidates[0].IsGroup);
    }

    [Fact]
    public async Task BuildCandidates_OffersGroupOnly_WhenNoStandaloneTableFits()
    {
        // Party of 8: no single 4-seat table fits, but the group (CombinedSeats 8) does.
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_OffersGroupOnly_WhenNoStandaloneTableFits));
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 8, DateTime.UtcNow.AddDays(12));

        TableCandidate group = Assert.Single(candidates);
        Assert.True(group.IsGroup);
        Assert.Equal(8, group.Seats);
        Assert.Equal(1, group.TableGroupId);
    }

    [Fact]
    public async Task BuildCandidates_ExcludesGroup_WhenAnyMemberIsBooked()
    {
        // Book one member (T3) of the group; the group can't be assigned for an overlapping slot.
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_ExcludesGroup_WhenAnyMemberIsBooked));
        DateTime date = DateTime.UtcNow.AddDays(13);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, TableId = 3, SectionId = 1, Date = date,
            BookingRef = "BG1", EndTime = date.AddMinutes(60)
        });
        db.SaveChanges();
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 8, date);

        Assert.DoesNotContain(candidates, c => c.IsGroup && c.TableGroupId == 1);
    }

    [Fact]
    public async Task BuildCandidates_ExcludesGroup_WhenAnyMemberIsHeld()
    {
        // Hold one member (T4) of the group; the group can't be assigned.
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_ExcludesGroup_WhenAnyMemberIsHeld));
        DateTime date = DateTime.UtcNow.AddDays(14);
        var holdService = new HoldService(new UtcClock());
        Assert.NotNull(holdService.PlaceHold(restaurantId: 1, tableId: 4, sectionId: 1, bookingDate: date));
        TableAutoAssigner assigner = CreateAssigner(db, holdService);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 8, date);

        Assert.DoesNotContain(candidates, c => c.IsGroup && c.TableGroupId == 1);
    }

    [Fact]
    public async Task BuildCandidates_OffersGroupedTablesIndividually_AfterUngroupedOnesOfTheSameSize()
    {
        // T3/T4 seat 4 each on their own, so a party of 4 must still be able to take one (#242) —
        // combining them only deprioritizes them, so they fill after the ungrouped T1/T2 and keep the
        // merged 8-seat option open as long as possible.
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_OffersGroupedTablesIndividually_AfterUngroupedOnesOfTheSameSize));
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 4, DateTime.UtcNow.AddDays(15));

        var singleTableIds = candidates.Where(c => !c.IsGroup).Select(c => c.TableId).ToList();
        Assert.Equal(new[] { 1, 2, 3, 4 }, singleTableIds);
        Assert.Contains(candidates, c => c.IsGroup && c.TableGroupId == 1);
        // …and the group itself still sorts last of all.
        Assert.True(candidates[^1].IsGroup);
    }

    [Fact]
    public async Task BuildCandidates_AppliesOversizeCap_ToGroups()
    {
        // MaxTableOversizeSeats = 2: a party of 2 at the 8-seat group exceeds the cap (8 - 2 = 6 > 2).
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_AppliesOversizeCap_ToGroups));
        restaurant.MaxTableOversizeSeats = 2;
        db.SaveChanges();
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 2, DateTime.UtcNow.AddDays(16));

        Assert.DoesNotContain(candidates, c => c.IsGroup && c.TableGroupId == 1);
    }

    [Fact]
    public async Task BuildCandidates_ReturnsEmpty_WhenNothingFits()
    {
        // Party of 10 exceeds both the standalone tables (4) and the group (8).
        var (restaurant, db) = SeedWithGroup(nameof(BuildCandidates_ReturnsEmpty_WhenNothingFits));
        TableAutoAssigner assigner = CreateAssigner(db);

        IReadOnlyList<TableCandidate> candidates = await assigner.BuildCandidatesAsync(restaurant, seats: 10, DateTime.UtcNow.AddDays(17));

        Assert.Empty(candidates);
    }
}
