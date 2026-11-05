using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class FloorStateTests
{
    private static readonly DateTime Now = new(2026, 11, 5, 19, 0, 0, DateTimeKind.Utc);

    private static Booking At(int minutesFromNow, BookingStatus status = BookingStatus.Booked, int length = 60, int id = 1)
        => new()
        {
            Id = id,
            RestaurantId = 1,
            Seats = 2,
            BookingRef = $"REF{id}",
            Date = Now.AddMinutes(minutesFromNow),
            EndTime = Now.AddMinutes(minutesFromNow + length),
            Status = status,
        };

    private static FloorReading Read(params Booking[] bookings) => FloorState.Read(bookings, Now, 60);

    [Fact]
    public void Read_IsFree_WithNoBookings()
    {
        FloorReading reading = Read();

        Assert.Equal(FloorTileState.Free, reading.State);
        Assert.Null(reading.Current);
        Assert.Null(reading.Next);
    }

    [Fact]
    public void Read_IsBookedSoon_WhenTheNextBookingStartsExactlyAtTheWindow()
    {
        Booking next = At((int)FloorState.BookedSoonWindow.TotalMinutes);

        FloorReading reading = Read(next);

        Assert.Equal(FloorTileState.BookedSoon, reading.State);
        Assert.Same(next, reading.Next);
    }

    [Fact]
    public void Read_IsFree_WhenTheNextBookingStartsAMinutePastTheWindow()
    {
        Booking later = At((int)FloorState.BookedSoonWindow.TotalMinutes + 1);

        FloorReading reading = Read(later);

        Assert.Equal(FloorTileState.Free, reading.State);
        Assert.Same(later, reading.Next);
    }

    [Fact]
    public void Read_IsBookedSoon_ForALatePartyThatHasNotSatDown()
    {
        FloorReading reading = Read(At(-20));

        Assert.Equal(FloorTileState.BookedSoon, reading.State);
    }

    [Fact]
    public void Read_IsFree_OnceALatePartysWholeSittingHasPassed()
    {
        FloorReading reading = Read(At(-90));

        Assert.Equal(FloorTileState.Free, reading.State);
        Assert.Null(reading.Next);
    }

    [Fact]
    public void Read_IsSeated_UpToTheEndOfTheSitting()
    {
        Booking seated = At(-60, BookingStatus.Seated);

        FloorReading reading = Read(seated);

        Assert.Equal(FloorTileState.Seated, reading.State);
        Assert.Same(seated, reading.Current);
        Assert.Equal(Now, reading.CurrentEndsAt);
    }

    [Fact]
    public void Read_IsOverdue_OnceTheClockPassesTheEnd()
    {
        FloorReading reading = Read(At(-61, BookingStatus.Seated));

        Assert.Equal(FloorTileState.Overdue, reading.State);
        Assert.Equal(Now.AddMinutes(-1), reading.CurrentEndsAt);
    }

    [Fact]
    public void Read_PrefersTheSeatedParty_AndStillNamesTheNextBooking()
    {
        Booking seated = At(-30, BookingStatus.Seated, id: 1);
        Booking next = At(15, id: 2);

        FloorReading reading = Read(next, seated);

        Assert.Equal(FloorTileState.Seated, reading.State);
        Assert.Same(seated, reading.Current);
        Assert.Same(next, reading.Next);
    }

    [Theory]
    [InlineData(BookingStatus.Finished)]
    [InlineData(BookingStatus.NoShow)]
    public void Read_IgnoresASittingThatHasEnded(BookingStatus status)
    {
        FloorReading reading = Read(At(-10, status));

        Assert.Equal(FloorTileState.Free, reading.State);
    }

    [Fact]
    public void Read_IgnoresACancelledBooking()
    {
        Booking cancelled = At(10);
        cancelled.IsCancelled = true;

        Assert.Equal(FloorTileState.Free, Read(cancelled).State);
    }

    [Fact]
    public void Read_FallsBackToTheDefaultLength_ForABookingWithNoEnd()
    {
        Booking seated = At(-50, BookingStatus.Seated);
        seated.EndTime = null;

        FloorReading reading = FloorState.Read([seated], Now, 45);

        Assert.Equal(FloorTileState.Overdue, reading.State);
    }
}
