using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Computes the ordered candidate-table list for "Any section" auto-assignment, shared by
/// the holds controller (hold placement) and <see cref="BookingService"/> (booking creation).
/// The actual atomic pick happens inside <see cref="IHoldService.PlaceAutoHold"/>'s lock —
/// this class only builds the pre-sorted pool (smallest fitting free table first).
/// </summary>
public sealed class TableAutoAssigner(IBookingRepository bookingRepository)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;

    /// <summary>
    /// Returns the restaurant's tables that (a) have at least <paramref name="seats"/> seats and
    /// (b) have no overlapping confirmed booking at <paramref name="bookingDateUtc"/>, ordered
    /// ascending by <see cref="Table.Seats"/> then <see cref="Table.Id"/> for a deterministic
    /// "smallest fitting free table" pick. Empty when nothing fits.
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
        // availability feed advertises per slot.
        var eligible = restaurant.Sections
            .Where(s => s.Tables != null)
            .SelectMany(s => s.Tables!.Where(t => t != null).Select(t => (table: t!, sectionId: s.Id)))
            .Where(x => x.table.Seats >= seats)
            .ToList();

        if (eligible.Count == 0)
        {
            return Array.Empty<TableCandidate>();
        }

        int durationMinutes = restaurant.DefaultBookingDurationMinutes;

        // Drop tables with an existing confirmed booking overlapping this slot. Done serially
        // because IsTableBookedOnDateAsync is per-table; the candidate count is small (one
        // restaurant's tables) and this runs once per auto-assign request before the lock.
        var free = new List<TableCandidate>(eligible.Count);
        foreach ((Table table, int sectionId) in eligible)
        {
            bool booked = await _bookingRepository.IsTableBookedOnDateAsync(
                table.Id, bookingDateUtc, durationMinutes);
            if (!booked)
            {
                free.Add(new TableCandidate(table.Id, sectionId, table.Seats));
            }
        }

        // Smallest fitting free table first; tie-break by id for deterministic ordering.
        return free
            .OrderBy(c => c.Seats)
            .ThenBy(c => c.TableId)
            .ToList();
    }
}
