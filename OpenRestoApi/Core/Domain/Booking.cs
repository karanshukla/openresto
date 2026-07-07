namespace OpenRestoApi.Core.Domain;

public class Booking
{
    /// <summary>
    /// Clock-skew tolerance (minutes) applied to the past-date guard shared by booking
    /// creation, cancellation, and table holds. A booking whose start is within this
    /// window of "now" is still treated as cancellable/createable. Referenced by
    /// <see cref="CanBeCancelledAt"/> and inlined (as a named constant) at the create/hold
    /// sites that operate on a <see cref="DateTime"/> before a <see cref="Booking"/> exists.
    /// </summary>
    public const int CancellationGraceMinutes = 5;

    /// <summary>
    /// Admin-grid "active" window (minutes). The admin bookings grid treats a booking as
    /// active until this many minutes after its start, so a 7pm booking still shows as
    /// "active" during service. Distinct from <see cref="CancellationGraceMinutes"/> (5 min)
    /// on purpose. Referenced by <see cref="IsPastForGrid"/>; the EF-translatable filter in
    /// <c>BookingFilterRepository</c> inlines <c>nowUtc.AddMinutes(-GridGraceMinutes)</c>.
    /// </summary>
    public const int GridGraceMinutes = 90;

    public int Id { get; set; }
    public Table? Table { get; set; }
    public int? TableId { get; set; }
    public Section? Section { get; set; }
    public int? SectionId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;
    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    public int Seats { get; set; }
    public string? SpecialRequests { get; set; }
    public string BookingRef { get; set; } = string.Empty;
    public DateTime? EndTime { get; set; }
    public bool IsCancelled { get; set; }
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// True when this booking can still be cancelled — its start (<see cref="Date"/>) is
    /// within <see cref="CancellationGraceMinutes"/> of <paramref name="nowUtc"/>. Keys off
    /// <see cref="Date"/> (start), NOT <see cref="EndTime"/>: a booking past its end but
    /// within 5 minutes of its start is still cancellable. Does NOT re-check
    /// <see cref="IsCancelled"/> — the two cancellation paths (customer-facing
    /// <c>BookingService.CancelBookingAsync</c>, admin <c>AdminService.CancelBookingAsync</c>)
    /// handle idempotency differently, so callers branch on it themselves.
    /// </summary>
    public bool CanBeCancelledAt(DateTime nowUtc)
        => Date >= nowUtc.AddMinutes(-CancellationGraceMinutes);

    /// <summary>
    /// True when this booking is "past" for the admin grid — its start is older than
    /// <see cref="GridGraceMinutes"/> ago. Excludes cancelled bookings by convention (the
    /// grid shows those under the "cancelled" filter, never as "past"). This is the
    /// in-memory counterpart of the EF-translatable filter in
    /// <c>BookingFilterRepository.QueryAsync</c> (<c>!b.IsCancelled &amp;&amp; b.Date &lt; cutoff</c>).
    /// </summary>
    public bool IsPastForGrid(DateTime nowUtc)
        => !IsCancelled && Date < nowUtc.AddMinutes(-GridGraceMinutes);

    /// <summary>
    /// Entity-local invariants: positive seats, a restaurant is assigned, the booking
    /// reference is non-empty, and <see cref="EndTime"/> (when present) is at or after
    /// <see cref="Date"/>. Cross-entity checks (table capacity, holds, conflicts, walk-in
    /// policy, opening hours, pause window) require external state and stay in the services.
    /// </summary>
    public bool IsValid()
        => Seats > 0
           && RestaurantId > 0
           && !string.IsNullOrEmpty(BookingRef)
           && (EndTime == null || EndTime >= Date);
}
