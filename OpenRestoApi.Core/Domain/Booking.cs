using OpenRestoApi.Core.Application.Utilities;

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
    /// on purpose. Referenced by <see cref="IsPastForGrid"/> and its EF-translatable twin,
    /// <c>BookingFilterRepository.WhereStatus</c>.
    /// </summary>
    public const int GridGraceMinutes = 90;

    /// <summary>How long staff can take back the last status change, for a mis-tap on the floor.</summary>
    public static readonly TimeSpan StatusUndoWindow = TimeSpan.FromMinutes(5);

    public int Id { get; set; }
    public Table? Table { get; set; }
    public int? TableId { get; set; }
    public Section? Section { get; set; }
    public int? SectionId { get; set; }
    /// <summary>
    /// When set, this booking reserves a <see cref="TableGroup"/> (combinable tables) instead of a
    /// single <see cref="Table"/>. Single-table/walk-in bookings leave it null and are entirely
    /// unchanged. Kept 1:1 with whatever the booking reserves so holds/availability/cancellation
    /// don't need a many-to-many from Booking→Table.
    /// </summary>
    public TableGroup? TableGroup { get; set; }
    public int? TableGroupId { get; set; }
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
    /// What has happened at the sitting. Independent of <see cref="IsCancelled"/>, which records a
    /// withdrawal before the sitting rather than anything on the floor.
    /// </summary>
    public BookingStatus Status { get; set; } = BookingStatus.Booked;

    /// <summary>The status before the last change, while that change can still be undone.</summary>
    public BookingStatus? PreviousStatus { get; set; }

    public DateTime? StatusChangedAt { get; set; }

    /// <summary>
    /// The <see cref="EndTime"/> a finish or no-show cut short, kept so undoing it restores the
    /// sitting. Null when the last change did not move the end.
    /// </summary>
    public DateTime? OriginalEndTime { get; set; }

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
    /// <see cref="GridGraceMinutes"/> ago, or the party has finished or not shown. Excludes
    /// cancelled bookings by convention (the grid shows those under the "cancelled" filter,
    /// never as "past"). The in-memory counterpart of <c>BookingFilterRepository.WhereStatus</c>.
    /// </summary>
    /// <seealso>BookingTests.IsPastForGrid_True_ForAFinishedSittingInsideTheGridGrace</seealso>
    public bool IsPastForGrid(DateTime nowUtc)
        => !IsCancelled && (Date < nowUtc.AddMinutes(-GridGraceMinutes) || Status.HasEnded());

    /// <summary>
    /// The statuses staff can move this booking to now, forward only. A no-show is offered only
    /// once the sitting has started, give or take <see cref="CancellationGraceMinutes"/> of clock
    /// skew, and a cancelled booking takes no status at all.
    /// </summary>
    /// <seealso>BookingTests.NextStatuses_OmitNoShow_BeforeTheSittingStarts</seealso>
    /// <seealso>BookingTests.NextStatuses_OfferNoShow_OnceTheSittingHasStarted</seealso>
    /// <seealso>BookingTests.NextStatuses_AreEmpty_ForACancelledBooking</seealso>
    public IReadOnlyList<BookingStatus> NextStatuses(DateTime nowUtc)
    {
        if (IsCancelled)
        {
            return [];
        }

        return Status switch
        {
            BookingStatus.Booked => HasStarted(nowUtc)
                ? [BookingStatus.Arrived, BookingStatus.Seated, BookingStatus.NoShow]
                : [BookingStatus.Arrived, BookingStatus.Seated],
            BookingStatus.Arrived => [BookingStatus.Seated],
            BookingStatus.Seated => [BookingStatus.Finished],
            _ => [],
        };
    }

    /// <summary>The status the last change can be undone to, or null once the window has passed.</summary>
    /// <seealso>BookingTests.UndoStatus_IsThePreviousStatus_InsideTheWindow</seealso>
    /// <seealso>BookingTests.UndoStatus_IsNull_OnceTheWindowHasPassed</seealso>
    public BookingStatus? UndoStatus(DateTime nowUtc)
        => !IsCancelled && StatusChangedAt.HasValue && nowUtc - StatusChangedAt.Value <= StatusUndoWindow
            ? PreviousStatus
            : null;

    /// <summary>
    /// Moves to <paramref name="next"/>, which must be one of <see cref="NextStatuses"/>. Finishing
    /// or a no-show ends the sitting now when that is sooner than its stored end, which is what
    /// frees the table: every conflict check, availability slot and wait estimate already honours
    /// <see cref="EndTime"/>. Neither ever moves the end later.
    /// </summary>
    /// <seealso>BookingTests.Advance_ToFinished_EndsTheSittingNow</seealso>
    /// <seealso>BookingTests.Advance_ToFinished_NeverLengthensTheSitting</seealso>
    public void Advance(BookingStatus next, DateTime nowUtc, int defaultDurationMinutes)
    {
        OriginalEndTime = null;
        if (next.HasEnded())
        {
            DateTime end = BookingDuration.ResolveEnd(Date, EndTime, defaultDurationMinutes);
            DateTime endsNow = nowUtc > Date ? nowUtc : Date;
            if (endsNow < end)
            {
                OriginalEndTime = end;
                EndTime = endsNow;
            }
        }

        PreviousStatus = Status;
        Status = next;
        StatusChangedAt = nowUtc;
    }

    /// <summary>Takes back the last change, restoring the end a finish or no-show cut short. One level only.</summary>
    /// <seealso>BookingTests.Undo_RestoresTheOriginalEndTime</seealso>
    public void UndoStatusChange()
    {
        if (OriginalEndTime.HasValue)
        {
            EndTime = OriginalEndTime;
        }

        Status = PreviousStatus ?? BookingStatus.Booked;
        PreviousStatus = null;
        StatusChangedAt = null;
        OriginalEndTime = null;
    }

    private bool HasStarted(DateTime nowUtc) => Date <= nowUtc.AddMinutes(CancellationGraceMinutes);

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

public enum BookingStatus
{
    Booked,
    Arrived,
    Seated,
    Finished,
    NoShow,
}

public static class BookingStatusExtensions
{
    public const int MaxLength = 16;

    /// <summary>True for the statuses that end a sitting and free its table.</summary>
    public static bool HasEnded(this BookingStatus status)
        => status is BookingStatus.Finished or BookingStatus.NoShow;
}
