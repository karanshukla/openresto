using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Computes the ordered candidate list for "Any section" auto-assignment, shared by the holds
/// controller (hold placement) and <see cref="BookingService"/> (booking creation). The actual
/// atomic pick happens inside <see cref="IHoldService.PlaceAutoHold"/>'s lock — this class only
/// builds the pre-sorted pool (smallest fitting free standalone table first; combinable groups
/// deprioritized so they're only chosen when no standalone table fits).
/// </summary>
public sealed class TableAutoAssigner(
    IBookingRepository bookingRepository,
    IHoldService holdService)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IHoldService _holdService = holdService;

    /// <summary>
    /// Returns the restaurant's bookable units — standalone tables and combinable groups — that (a)
    /// have at least <paramref name="seats"/> seats, (b) respect the optional
    /// <see cref="Restaurant.MaxTableOversizeSeats"/> cap, and (c) have no overlapping confirmed
    /// booking or active hold at <paramref name="bookingDateUtc"/>. Ordered so the smallest fitting
    /// standalone table wins; groups of equal capacity sort after standalone tables (the
    /// deprioritization requested in #272 — combinable tables fill last, giving larger groups more
    /// time to book). <see cref="Table.TableId"/> within each tier ties-breaks deterministically.
    /// Empty when nothing fits.
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

        // Standalone tables that are ungrouped AND free (no booking, no hold). A table that belongs
        // to a combinable group is bookable only as part of its group below — it must not also be
        // offered individually, or the mutual-exclusion invariant can't hold.
        var groupedTableIds = (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .SelectMany(g => g.Members).Select(m => m.TableId).ToHashSet();

        // Drop tables with an existing confirmed booking overlapping this slot. Done serially
        // because IsTableBookedOnDateAsync is per-table; the candidate count is small (one
        // restaurant's tables) and this runs once per auto-assign request before the lock.
        foreach ((Table table, int sectionId) in eligible)
        {
            if (groupedTableIds.Contains(table.Id)) continue;

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

        // Smallest fitting free table first; standalone tables precede groups of equal capacity
        // (deprioritization — combinable tables fill last); tie-break by id for deterministic ordering.
        return free
            .OrderBy(c => c.Seats)
            .ThenBy(c => c.IsGroup)
            .ThenBy(c => c.TableId)
            .ToList();
    }
}
