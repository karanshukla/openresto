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
