using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Computes the ordered candidate list for "Any section" auto-assignment, shared by the holds
/// controller and <see cref="BookingService"/>. This class only builds the pre-sorted pool; the
/// atomic pick happens inside <see cref="IHoldService.PlaceAutoHold"/>'s lock, so a candidate
/// here is a proposal, not a reservation.
/// </summary>
public sealed class TableAutoAssigner(
    IBookingRepository bookingRepository,
    IHoldService holdService)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IHoldService _holdService = holdService;

    /// <summary>
    /// The restaurant's bookable units that can seat <paramref name="seats"/> (see
    /// <see cref="Restaurant.CanSeat"/>) and carry no overlapping booking or hold at
    /// <paramref name="bookingDateUtc"/>, ordered smallest-fitting-first and then by
    /// <see cref="DeprioritizationTier"/>. Empty when nothing fits.
    /// </summary>
    /// <seealso>TableAutoAssignerTests.BuildCandidates_PrefersStandaloneTable_WhenPartyFitsBoth</seealso>
    /// <seealso>TableAutoAssignerTests.BuildCandidates_OffersGroupOnly_WhenNoStandaloneTableFits</seealso>
    public async Task<IReadOnlyList<TableCandidate>> BuildCandidatesAsync(
        Restaurant restaurant,
        int seats,
        DateTime bookingDateUtc)
    {
        if (restaurant.Sections is null || restaurant.Sections.Count == 0 || seats <= 0)
        {
            return Array.Empty<TableCandidate>();
        }

        int durationMinutes = restaurant.DefaultBookingDurationMinutes;
        var free = new List<TableCandidate>();
        free.AddRange(await FreeTablesAsync(restaurant, seats, bookingDateUtc, durationMinutes));
        free.AddRange(await FreeGroupsAsync(restaurant, seats, bookingDateUtc, durationMinutes));

        HashSet<int> groupedTableIds = GroupedTableIds(restaurant);

        return free
            .OrderBy(c => c.Seats)
            .ThenBy(c => DeprioritizationTier(c, groupedTableIds))
            .ThenBy(c => c.TableId)
            .ToList();
    }

    /// <summary>
    /// An ungrouped table beats a combinable table of the same size, which beats a group of that
    /// size, so combinable tables stay free as long as possible for the larger parties that need
    /// them pushed together. Grouping a table only moves it down this order — it never leaves the
    /// individual pool, because a table in a group still seats its own capacity on its own.
    /// </summary>
    /// <seealso>TableAutoAssignerTests.BuildCandidates_OffersGroupedTablesIndividually_AfterUngroupedOnesOfTheSameSize</seealso>
    /// <seealso>TableAutoAssignerTests.BuildCandidates_DeprioritizesGroups_AgainstStandaloneTablesOfEqualCapacity</seealso>
    private static int DeprioritizationTier(TableCandidate candidate, HashSet<int> groupedTableIds)
        => candidate.IsGroup ? 2 : groupedTableIds.Contains(candidate.TableId) ? 1 : 0;

    private static HashSet<int> GroupedTableIds(Restaurant restaurant)
        => (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .SelectMany(g => g.Members).Select(m => m.TableId).ToHashSet();

    /// <summary>
    /// Checked serially because the repository answers one unit at a time. The pool is a single
    /// restaurant's tables and this runs once per auto-assign request, before the lock.
    /// </summary>
    private async Task<List<TableCandidate>> FreeTablesAsync(
        Restaurant restaurant, int seats, DateTime bookingDateUtc, int durationMinutes)
    {
        var free = new List<TableCandidate>();

        IEnumerable<(Table Table, int SectionId)> eligible = restaurant.Sections!
            .Where(s => s.Tables != null)
            .SelectMany(s => s.Tables!.Where(t => t != null).Select(t => (Table: t!, SectionId: s.Id)))
            .Where(x => restaurant.CanSeat(x.Table.Seats, seats));

        foreach ((Table table, int sectionId) in eligible)
        {
            bool booked = await _bookingRepository.IsUnitBookedOnDateAsync(
                table.Id, tableGroupId: null, bookingDateUtc, durationMinutes);
            if (!booked && !_holdService.IsTableHeld(table.Id, bookingDateUtc, durationMinutes: durationMinutes))
            {
                free.Add(new TableCandidate(table.Id, sectionId, table.Seats));
            }
        }

        return free;
    }

    private async Task<List<TableCandidate>> FreeGroupsAsync(
        Restaurant restaurant, int seats, DateTime bookingDateUtc, int durationMinutes)
    {
        var free = new List<TableCandidate>();
        if (restaurant.Groups is not { Count: > 0 })
        {
            return free;
        }

        foreach (TableGroup group in restaurant.Groups)
        {
            if (!restaurant.CanSeat(group.CombinedSeats, seats)) continue;

            var memberIds = group.Members.Select(m => m.TableId).ToList();
            if (memberIds.Count == 0) continue;

            // One query covers all three ways a group can be taken: the group itself booked, a
            // member booked individually, or a member reserved by a sibling group's booking.
            bool groupBooked = await _bookingRepository.IsUnitBookedOnDateAsync(
                tableId: null, tableGroupId: group.Id, bookingDateUtc, durationMinutes);
            if (groupBooked) continue;

            bool anyMemberHeld = memberIds.Any(
                id => _holdService.IsTableHeld(id, bookingDateUtc, durationMinutes: durationMinutes));
            if (anyMemberHeld) continue;

            // Anchored to the lowest member's id/section so callers reading TableId/SectionId still
            // get a concrete value; the group identity rides on TableGroupId + MemberTableIds.
            TableGroupMembership anchor = group.Members.OrderBy(m => m.TableId).First();
            free.Add(new TableCandidate(
                anchor.TableId,
                anchor.Table?.SectionId ?? 0,
                group.CombinedSeats,
                IsGroup: true,
                TableGroupId: group.Id,
                MemberTableIds: memberIds));
        }

        return free;
    }
}
