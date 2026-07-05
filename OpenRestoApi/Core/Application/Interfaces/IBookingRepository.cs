using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface IBookingRepository
{
    Task<Booking?> GetByIdAsync(int id);
    Task<Booking?> GetByRefAsync(string bookingRef);
    Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId);
    Task<Booking> AddAsync(Booking booking);
    Task<Booking> UpdateAsync(Booking booking);
    Task DeleteAsync(int id);
    /// <summary>
    /// Returns true if a confirmed booking exists for this table whose occupancy window overlaps
    /// [<paramref name="bookingDate"/>, <paramref name="bookingDate"/> + <paramref name="durationMinutes"/>).
    /// For existing bookings without an explicit <c>EndTime</c>, <paramref name="durationMinutes"/> is
    /// also used as the fallback occupancy window.
    /// </summary>
    Task<bool> IsTableBookedOnDateAsync(int tableId, DateTime bookingDate, int durationMinutes = 60);
    /// <summary>Returns all non-cancelled bookings for a specific restaurant and local date.</summary>
    Task<IEnumerable<Booking>> GetActiveBookingsForDateAsync(int restaurantId, DateTime bookingDate);

    // ── Bundle 2 additions ───────────────────────────────────────────────────

    /// <summary>Finds a booking by id with NO navigation properties loaded. Use <see cref="GetByIdAsync"/> for the eager-loaded graph.</summary>
    Task<Booking?> FindByIdAsync(int id);

    /// <summary>Total non-cancelled bookings, across all restaurants.</summary>
    Task<int> CountActiveAsync();

    /// <summary>Sum of <see cref="Booking.Seats"/> across all non-cancelled bookings (0 when none).</summary>
    Task<int> SumActiveSeatsAsync();

    /// <summary>Count of non-cancelled bookings whose <see cref="Booking.Date"/> falls in [<paramref name="startUtc"/>, <paramref name="endUtc"/>).</summary>
    Task<int> CountActiveByDayAsync(DateTime startUtc, DateTime endUtc);

    /// <summary>
    /// Non-cancelled bookings for a restaurant whose occupancy window intersects the moment
    /// <paramref name="nowUtc"/>. Navigation properties (Restaurant/Section/Table) are eager-loaded.
    /// Used by <c>AdminService.ExtendAllActiveBookingsAsync</c>.
    /// </summary>
    Task<List<Booking>> GetInProgressForRestaurantAsync(int restaurantId, DateTime nowUtc, int defaultDurationMinutes);

    /// <summary>
    /// Non-cancelled bookings for a restaurant whose <see cref="Booking.Date"/> is in
    /// [<paramref name="startUtc"/>, <paramref name="endUtc"/>) and whose navigation properties
    /// are eager-loaded. Used by the overview "today" list.
    /// </summary>
    Task<List<Booking>> GetForRestaurantInUtcRangeAsync(int restaurantId, DateTime startUtc, DateTime endUtc);

    /// <summary>
    /// True if any other booking on the same table overlaps the window
    /// [<paramref name="newStart"/>, <paramref name="newEnd"/>). Existing bookings without an
    /// explicit <see cref="Booking.EndTime"/> use <c>Booking.Date + <paramref name="fallbackDurationMinutes"/></c>
    /// as their end. Pass <paramref name="excludeBookingId"/> to skip a booking being updated.
    /// </summary>
    Task<bool> HasConflictAsync(int? tableId, DateTime newStart, DateTime newEnd, int fallbackDurationMinutes, int? excludeBookingId = null);

    /// <summary>Distinct count of tables with at least one non-cancelled booking in the UTC window — used by the capacity notification.</summary>
    Task<int> CountDistinctBookedTablesAsync(int restaurantId, DateTime startUtc, DateTime endUtc);

    /// <summary>Adds multiple bookings to the change tracker (caller is responsible for SaveChanges).</summary>
    Task AddRangeAsync(IEnumerable<Booking> bookings);

    /// <summary>Removes multiple bookings (caller is responsible for SaveChanges).</summary>
    void RemoveRange(IEnumerable<Booking> bookings);

    /// <summary>
    /// Flushes all pending changes on the underlying DbContext. Exposed so services that mutate
    /// multiple tracked entities (loaded via read methods) can persist them in a single round-trip,
    /// mirroring the prior <c>SaveChangesAsync</c>-once-per-method behavior.
    /// </summary>
    Task SaveChangesAsync();

    /// <summary>
    /// All bookings whose SectionId matches, OR whose TableId is in <paramref name="tableIds"/> — used by
    /// RestaurantManagementService.DeleteSectionAsync to FK-null affected bookings before the cascade.
    /// </summary>
    Task<List<Booking>> GetBySectionOrTablesAsync(int sectionId, IReadOnlyList<int> tableIds);

    /// <summary>All bookings assigned to a table — used by RestaurantManagementService.DeleteTableAsync to FK-null them.</summary>
    Task<List<Booking>> GetByTableAsync(int tableId);
}
