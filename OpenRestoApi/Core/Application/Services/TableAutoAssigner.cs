using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Computes the ordered candidate list for "Any section" auto-assignment, shared by the holds
/// controller (hold placement) and <see cref="BookingService"/> (booking creation). The actual
/// atomic pick happens inside <see cref="IHoldService.PlaceAutoHold"/>'s lock — this class only
/// builds the pre-sorted pool (smallest fitting free table first, with combinable tables
/// deprioritized within each size so they stay free for the larger parties that need them merged).
/// </summary>
public sealed class TableAutoAssigner(
    IBookingRepository bookingRepository,
    IHoldService holdService)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IHoldService _holdService = holdService;

    /// <summary>
    /// Returns the restaurant's bookable units — individual tables and combinable groups — that (a)
    /// have at least <paramref name="seats"/> seats, (b) respect the optional
    /// <see cref="Restaurant.MaxTableOversizeSeats"/> cap, and (c) have no overlapping confirmed
    /// booking or active hold at <paramref name="bookingDateUtc"/>. Ordered smallest-fitting-first,
    /// then by the deprioritization tier requested in #242 — an ungrouped table wins over a
    /// combinable table of the same size, which in turn wins over a group of that size, so
    /// combinable tables stay free as long as possible for the larger parties that need them pushed
    /// together. Table id ties-breaks within a tier for deterministic ordering. Empty when nothing
    /// fits.
    /// </summary>
    public async Task<IReadOnlyList<TableCandidate>> BuildCandidatesAsync(
        Restaurant restaurant,
        int seats,
        DateTime bookingDateUtc)
    {
        if (restaurant.Sections is null || restaurant.Sections.Count == 0 || seats <= 0)
        {
            return Array.Empty<TableCandidate>();
        }

        // Capacity filter first — same predicate as AvailabilityService.GetAvailabilityAsync's
        // restaurant-wide eligible-table set, so the auto-assign pool matches what the
        // availability feed advertises per slot. The optional upper bound
        // (Restaurant.MaxTableOversizeSeats) keeps a small party off a much larger table.
        var eligible = restaurant.Sections
            .Where(s => s.Tables != null)
            .SelectMany(s => s.Tables!.Where(t => t != null).Select(t => (table: t!, sectionId: s.Id)))
            .Where(x => x.table.Seats >= seats
                && (restaurant.MaxTableOversizeSeats == null
                    || x.table.Seats - seats <= restaurant.MaxTableOversizeSeats.Value))
            .ToList();

        int durationMinutes = restaurant.DefaultBookingDurationMinutes;

        var free = new List<TableCandidate>();

        // Membership of a combinable group does NOT remove a table from the individual pool: tables 8
        // and 9 seat 4 each on their own and must keep taking parties of 4 (#242). It only pushes them
        // down the ordering below, so they're the last of their size to fill. Mutual exclusion between
        // a member booking and its group's booking is enforced by IsUnitBookedOnDateAsync/IsTableHeld,
        // not by hiding the table.
        var groupedTableIds = (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .SelectMany(g => g.Members).Select(m => m.TableId).ToHashSet();

        // Drop tables with an existing confirmed booking overlapping this slot. Done serially
        // because IsTableBookedOnDateAsync is per-table; the candidate count is small (one
        // restaurant's tables) and this runs once per auto-assign request before the lock.
        foreach ((Table table, int sectionId) in eligible)
        {
            // Group-aware: also blocks when the table is reserved by a group booking (which stores
            // TableId = null and so is invisible to the table-only check).
            bool booked = await _bookingRepository.IsUnitBookedOnDateAsync(
                table.Id, tableGroupId: null, bookingDateUtc, durationMinutes);
            if (!booked && !_holdService.IsTableHeld(table.Id, bookingDateUtc, durationMinutes: durationMinutes))
            {
                free.Add(new TableCandidate(table.Id, sectionId, table.Seats));
            }
        }

        // Combinable groups: capacity check against CombinedSeats, all members must be free.
        // The oversize cap applies to groups too (#272) — don't seat a party of 2 at an 8-seat
        // combined group unless the cap allows it.
        if (restaurant.Groups is { Count: > 0 })
        {
            foreach (TableGroup group in restaurant.Groups)
            {
                if (group.CombinedSeats < seats) continue;
                if (restaurant.MaxTableOversizeSeats.HasValue
                    && group.CombinedSeats - seats > restaurant.MaxTableOversizeSeats.Value)
                {
                    continue;
                }

                var memberIds = group.Members.Select(m => m.TableId).ToList();
                if (memberIds.Count == 0) continue;

                // Group-aware: a single check catches the group already booked, a member booked
                // individually, or a member reserved by a sibling group booking.
                bool groupBooked = await _bookingRepository.IsUnitBookedOnDateAsync(
                    tableId: null, tableGroupId: group.Id, bookingDateUtc, durationMinutes);

                bool allMembersFreeOfHolds = !groupBooked;
                if (allMembersFreeOfHolds)
                {
                    foreach (int memberId in memberIds)
                    {
                        if (_holdService.IsTableHeld(memberId, bookingDateUtc, durationMinutes: durationMinutes))
                        {
                            allMembersFreeOfHolds = false;
                            break;
                        }
                    }
                }

                if (!allMembersFreeOfHolds) continue;

                // Anchor to the first member's id/section so existing callers that read TableId/SectionId
                // still get a concrete value; the group identity rides on TableGroupId + MemberTableIds.
                TableGroupMembership anchor = group.Members.OrderBy(m => m.TableId).First();
                free.Add(new TableCandidate(
                    anchor.TableId,
                    anchor.Table?.SectionId ?? 0,
                    group.CombinedSeats,
                    IsGroup: true,
                    TableGroupId: group.Id,
                    MemberTableIds: memberIds));
            }
        }

        // Smallest fitting free unit first, then the deprioritization tier (ungrouped table → grouped
        // table → group), then id for deterministic ordering.
        int Tier(TableCandidate c) => c.IsGroup ? 2 : groupedTableIds.Contains(c.TableId) ? 1 : 0;

        return free
            .OrderBy(c => c.Seats)
            .ThenBy(Tier)
            .ThenBy(c => c.TableId)
            .ToList();
    }
}
