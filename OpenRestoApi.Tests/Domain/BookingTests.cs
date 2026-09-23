using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class BookingTests
{
    private static DateTime Utc(int minutesFromNow) => DateTime.UtcNow.AddMinutes(minutesFromNow);

    private static Booking NewBooking(
        int seats = 2,
        int restaurantId = 1,
        string? bookingRef = "REF-1",
        DateTime? date = null,
        DateTime? endTime = null,
        bool isCancelled = false)
        => new()
        {
            Id = 1,
            RestaurantId = restaurantId,
            Seats = seats,
            BookingRef = bookingRef ?? string.Empty,
            Date = date ?? Utc(60),
            EndTime = endTime,
            IsCancelled = isCancelled
        };

    // ── Constants ──────────────────────────────────────────────────────────────

    [Fact]
    public void CancellationGraceMinutes_IsFive()
        => Assert.Equal(5, Booking.CancellationGraceMinutes);

    [Fact]
    public void GridGraceMinutes_IsNinety()
        => Assert.Equal(90, Booking.GridGraceMinutes);

    // ── CanBeCancelledAt ───────────────────────────────────────────────────────

    [Theory]
    [InlineData(0)]   // exactly now
    [InlineData(-4)]  // within the 5-min tolerance
    [InlineData(60)]  // in the future
    public void CanBeCancelledAt_True_WhenStartWithinGraceWindow(int startOffsetMinutes)
    {
        Booking b = NewBooking(date: Utc(startOffsetMinutes));
        Assert.True(b.CanBeCancelledAt(DateTime.UtcNow));
    }

    [Theory]
    [InlineData(-6)]   // just past the 5-min tolerance
    [InlineData(-120)] // long past
    public void CanBeCancelledAt_False_WhenStartOlderThanGraceWindow(int startOffsetMinutes)
    {
        Booking b = NewBooking(date: Utc(startOffsetMinutes));
        Assert.False(b.CanBeCancelledAt(DateTime.UtcNow));
    }

    [Fact]
    public void CanBeCancelledAt_KeysOffStart_NotEndTime()
    {
        // Start is in the future (cancellable), but EndTime is already in the past.
        // The rule keys off Date, so this is still cancellable.
        Booking b = NewBooking(date: Utc(60), endTime: Utc(-10));
        Assert.True(b.CanBeCancelledAt(DateTime.UtcNow));
    }

    [Fact]
    public void CanBeCancelledAt_IgnoresIsCancelled()
    {
        // The method does NOT consult IsCancelled — callers branch on it themselves.
        Booking cancelled = NewBooking(date: Utc(60), isCancelled: true);
        Assert.True(cancelled.CanBeCancelledAt(DateTime.UtcNow));
    }

    // ── IsPastForGrid ──────────────────────────────────────────────────────────

    [Fact]
    public void IsPastForGrid_True_WhenUnCancelledAndOlderThanGridGrace()
    {
        Booking b = NewBooking(date: Utc(-120)); // 2 hours ago, beyond the 90-min window
        Assert.True(b.IsPastForGrid(DateTime.UtcNow));
    }

    [Theory]
    [InlineData(-60)]  // within the 90-min grid window
    [InlineData(0)]    // now
    [InlineData(30)]   // future
    public void IsPastForGrid_False_WhenWithinGridGraceWindow(int startOffsetMinutes)
    {
        Booking b = NewBooking(date: Utc(startOffsetMinutes));
        Assert.False(b.IsPastForGrid(DateTime.UtcNow));
    }

    [Fact]
    public void IsPastForGrid_False_WhenCancelled_EvenIfOld()
    {
        // Cancelled bookings are never "past" — they belong to the "cancelled" filter.
        Booking b = NewBooking(date: Utc(-480), isCancelled: true);
        Assert.False(b.IsPastForGrid(DateTime.UtcNow));
    }

    [Fact]
    public void IsPastForGrid_True_ForAFinishedSittingInsideTheGridGrace()
    {
        Booking b = NewBooking(date: Utc(-30));
        b.Status = BookingStatus.Finished;
        Assert.True(b.IsPastForGrid(DateTime.UtcNow));
    }

    // ── Status ─────────────────────────────────────────────────────────────────

    [Fact]
    public void NextStatuses_OmitNoShow_BeforeTheSittingStarts()
    {
        Booking b = NewBooking(date: Utc(Booking.CancellationGraceMinutes + 1));
        Assert.DoesNotContain(BookingStatus.NoShow, b.NextStatuses(DateTime.UtcNow));
    }

    [Theory]
    [InlineData(Booking.CancellationGraceMinutes - 1)] // inside the clock-skew grace
    [InlineData(-30)]
    public void NextStatuses_OfferNoShow_OnceTheSittingHasStarted(int startOffsetMinutes)
    {
        Booking b = NewBooking(date: Utc(startOffsetMinutes));
        Assert.Contains(BookingStatus.NoShow, b.NextStatuses(DateTime.UtcNow));
    }

    [Fact]
    public void NextStatuses_AreEmpty_ForACancelledBooking()
    {
        Booking b = NewBooking(date: Utc(-30), isCancelled: true);
        Assert.Empty(b.NextStatuses(DateTime.UtcNow));
    }

    [Theory]
    [InlineData(BookingStatus.Finished)]
    [InlineData(BookingStatus.NoShow)]
    public void NextStatuses_AreEmpty_OnceTheSittingHasEnded(BookingStatus ended)
    {
        Booking b = NewBooking(date: Utc(-30));
        b.Status = ended;
        Assert.Empty(b.NextStatuses(DateTime.UtcNow));
    }

    [Fact]
    public void NextStatuses_OnlyMoveForward()
    {
        Booking b = NewBooking(date: Utc(-30));
        b.Status = BookingStatus.Seated;
        Assert.Equal([BookingStatus.Finished], b.NextStatuses(DateTime.UtcNow));
    }

    [Fact]
    public void Advance_ToFinished_EndsTheSittingNow()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(-30), endTime: now.AddMinutes(30));
        b.Status = BookingStatus.Seated;

        b.Advance(BookingStatus.Finished, now, 60);

        Assert.Equal(now, b.EndTime);
        Assert.Equal(now.AddMinutes(30), b.OriginalEndTime);
        Assert.Equal(BookingStatus.Seated, b.PreviousStatus);
    }

    [Fact]
    public void Advance_ToFinished_NeverLengthensTheSitting()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(-120), endTime: now.AddMinutes(-30));
        b.Status = BookingStatus.Seated;

        b.Advance(BookingStatus.Finished, now, 60);

        Assert.Equal(now.AddMinutes(-30), b.EndTime);
        Assert.Null(b.OriginalEndTime);
    }

    [Fact]
    public void Advance_ToNoShow_NeverEndsTheSittingBeforeItsStart()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(3), endTime: now.AddMinutes(63));

        b.Advance(BookingStatus.NoShow, now, 60);

        Assert.Equal(now.AddMinutes(3), b.EndTime);
        Assert.True(b.IsValid());
    }

    [Fact]
    public void Undo_RestoresTheOriginalEndTime()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(-30), endTime: now.AddMinutes(30));
        b.Status = BookingStatus.Seated;
        b.Advance(BookingStatus.Finished, now, 60);

        b.UndoStatusChange();

        Assert.Equal(BookingStatus.Seated, b.Status);
        Assert.Equal(now.AddMinutes(30), b.EndTime);
        Assert.Null(b.UndoStatus(now));
    }

    [Fact]
    public void UndoStatus_IsThePreviousStatus_InsideTheWindow()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(-30));
        b.Advance(BookingStatus.Arrived, now, 60);

        Assert.Equal(BookingStatus.Booked, b.UndoStatus(now + Booking.StatusUndoWindow));
    }

    [Fact]
    public void UndoStatus_IsNull_OnceTheWindowHasPassed()
    {
        DateTime now = DateTime.UtcNow;
        Booking b = NewBooking(date: now.AddMinutes(-30));
        b.Advance(BookingStatus.Arrived, now, 60);

        Assert.Null(b.UndoStatus(now + Booking.StatusUndoWindow + TimeSpan.FromSeconds(1)));
    }

    // ── IsValid ────────────────────────────────────────────────────────────────

    [Fact]
    public void IsValid_True_ForWellFormedBooking()
    {
        Booking b = NewBooking(seats: 4, restaurantId: 1, bookingRef: "REF-1",
            date: Utc(60), endTime: Utc(120));
        Assert.True(b.IsValid());
    }

    [Fact]
    public void IsValid_True_WhenEndTimeNull()
    {
        // Legacy rows have no EndTime — that's valid.
        Booking b = NewBooking(endTime: null);
        Assert.True(b.IsValid());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void IsValid_False_WhenSeatsNotPositive(int seats)
    {
        Booking b = NewBooking(seats: seats);
        Assert.False(b.IsValid());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void IsValid_False_WhenRestaurantIdNotPositive(int restaurantId)
    {
        Booking b = NewBooking(restaurantId: restaurantId);
        Assert.False(b.IsValid());
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void IsValid_False_WhenBookingRefMissing(string? bookingRef)
    {
        Booking b = NewBooking();
        b.BookingRef = bookingRef ?? string.Empty;
        Assert.False(b.IsValid());
    }

    [Fact]
    public void IsValid_False_WhenEndTimeBeforeStart()
    {
        Booking b = NewBooking(date: Utc(120), endTime: Utc(60));
        Assert.False(b.IsValid());
    }

    [Fact]
    public void IsValid_True_WhenEndTimeEqualsStart()
    {
        // Edge: a zero-duration booking (EndTime == Date) is technically valid.
        DateTime start = Utc(60);
        Booking b = NewBooking(date: start, endTime: start);
        Assert.True(b.IsValid());
    }
}
