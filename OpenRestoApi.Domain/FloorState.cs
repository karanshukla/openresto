namespace OpenRestoApi.Core.Domain;

/// <summary>What a table (or combinable group) is doing right now, as the host stand reads it.</summary>
public enum FloorTileState
{
    Free,
    BookedSoon,
    Seated,
    Overdue,
}

/// <summary>
/// A unit's derived state and the bookings that decided it. Never stored: every read recomputes it
/// from the bookings and the clock, so a status change or an extension shows up on the next poll.
/// </summary>
public sealed record FloorReading(
    FloorTileState State,
    Booking? Current,
    DateTime? CurrentEndsAt,
    Booking? Next);

/// <summary>Derives a host-stand tile from the bookings that occupy one table or group.</summary>
public static class FloorState
{
    /// <summary>How far ahead a booking holds a free table back from a walk-in.</summary>
    public static readonly TimeSpan BookedSoonWindow = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Seated wins over everything (overdue once the clock is past its end); otherwise a booking
    /// that has not sat down yet and starts within <see cref="BookedSoonWindow"/>, or is already
    /// late, marks the unit booked soon; otherwise it is free. Finished and no-show sittings have
    /// left the floor and count for nothing.
    /// </summary>
    /// <seealso>FloorStateTests.Read_IsBookedSoon_WhenTheNextBookingStartsExactlyAtTheWindow</seealso>
    /// <seealso>FloorStateTests.Read_IsFree_WhenTheNextBookingStartsAMinutePastTheWindow</seealso>
    /// <seealso>FloorStateTests.Read_IsSeated_UpToTheEndOfTheSitting</seealso>
    /// <seealso>FloorStateTests.Read_IsOverdue_OnceTheClockPassesTheEnd</seealso>
    /// <seealso>FloorStateTests.Read_IsBookedSoon_ForALatePartyThatHasNotSatDown</seealso>
    public static FloorReading Read(IEnumerable<Booking> bookingsOnUnit, DateTime nowUtc, int? defaultDurationMinutes)
    {
        List<Booking> live = bookingsOnUnit
            .Where(b => !b.IsCancelled && !b.Status.HasEnded())
            .OrderBy(b => b.Date)
            .ToList();

        Booking? next = live.FirstOrDefault(b =>
            b.Status is BookingStatus.Booked or BookingStatus.Arrived
            && BookingDuration.ResolveEnd(b.Date, b.EndTime, defaultDurationMinutes) > nowUtc);

        Booking? seated = live.FirstOrDefault(b => b.Status == BookingStatus.Seated);
        if (seated != null)
        {
            DateTime end = BookingDuration.ResolveEnd(seated.Date, seated.EndTime, defaultDurationMinutes);
            FloorTileState state = nowUtc > end ? FloorTileState.Overdue : FloorTileState.Seated;
            return new FloorReading(state, seated, end, next);
        }

        if (next != null && next.Date <= nowUtc + BookedSoonWindow)
        {
            return new FloorReading(FloorTileState.BookedSoon, null, null, next);
        }

        return new FloorReading(FloorTileState.Free, null, null, next);
    }
}
