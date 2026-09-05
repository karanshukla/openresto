using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// The stand-in booking behind the admin's confirmation-email preview. It is illustrative, but
/// not arbitrary: it sits on a day the location actually opens, inside that day's service, so a
/// preview never shows a sitting the location could not take.
/// </summary>
public class EmailPreviewSampleTests
{
    // A Monday, so "the next open day" is a forward walk with somewhere to go.
    private static readonly DateTime Monday = new(2026, 9, 7, 10, 0, 0, DateTimeKind.Utc);

    private static Restaurant Location(string open = "11:00", string close = "23:00", string openDays = "1,2,3,4,5,6,7")
        => new() { Id = 1, Name = "Test", Timezone = "UTC", OpenTime = open, CloseTime = close, OpenDays = openDays };

    [Fact]
    public void BookingFor_SkipsForwardToTheNextDayTheLocationOpens()
    {
        // Saturday only.
        Booking booking = EmailPreviewSample.BookingFor(Location(openDays: "6"), Monday);

        Assert.Equal(DayOfWeek.Saturday, booking.Date.DayOfWeek);
        Assert.Equal(new DateTime(2026, 9, 12, 19, 0, 0, DateTimeKind.Utc), booking.Date);
    }

    [Fact]
    public void BookingFor_SitsAtSevenWhenTheDaysServiceReachesIt()
    {
        Booking booking = EmailPreviewSample.BookingFor(Location("11:00", "23:00"), Monday);

        Assert.Equal(new TimeSpan(19, 0, 0), booking.Date.TimeOfDay);
    }

    /// <summary>The other side of the same boundary: a lunch-only location previews its own service.</summary>
    [Fact]
    public void BookingFor_SitsAtOpeningTimeWhenServiceEndsBeforeSeven()
    {
        Booking booking = EmailPreviewSample.BookingFor(Location("08:00", "15:00"), Monday);

        Assert.Equal(new TimeSpan(8, 0, 0), booking.Date.TimeOfDay);
    }

    /// <summary>
    /// A close earlier than the open runs past midnight, so 19:00 is inside that service rather
    /// than after it — measuring the window as a plain subtraction is what would get this wrong.
    /// </summary>
    [Fact]
    public void BookingFor_SitsAtSevenInsideAServiceRunningPastMidnight()
    {
        Booking booking = EmailPreviewSample.BookingFor(Location("18:00", "02:00"), Monday);

        Assert.Equal(new TimeSpan(19, 0, 0), booking.Date.TimeOfDay);
    }

    [Fact]
    public void BookingFor_TakesTheFirstTableOfTheFirstSection()
    {
        Restaurant restaurant = Location();
        var terrace = new Section { Id = 2, Name = "Terrace", SortOrder = 1 };
        var window = new Section { Id = 3, Name = "Window", SortOrder = 0 };
        window.Tables.Add(new Table { Id = 9, Name = "W1", Seats = 2 });
        terrace.Tables.Add(new Table { Id = 4, Name = "T1", Seats = 4 });
        restaurant.Sections.Add(terrace);
        restaurant.Sections.Add(window);

        Booking booking = EmailPreviewSample.BookingFor(restaurant, Monday);

        Assert.Equal("Window", booking.Section?.Name);
        Assert.Equal("W1", booking.Table?.Name);
    }

    [Fact]
    public void BookingFor_UsesTheLocationsOwnReferenceFormatAndSittingLength()
    {
        Restaurant restaurant = Location();
        restaurant.BookingRefFormat = BookingRefFormat.Numeric;
        restaurant.DefaultBookingDurationMinutes = 90;

        Booking booking = EmailPreviewSample.BookingFor(restaurant, Monday);

        Assert.Equal(EmailPreviewSample.RefFor(BookingRefFormat.Numeric), booking.BookingRef);
        Assert.Equal(booking.Date.AddMinutes(90), booking.EndTime);
    }

    /// <summary>Unparseable hours must not take the preview down with them.</summary>
    [Fact]
    public void BookingFor_FallsBackToSevenWhenTheDaysHoursDoNotParse()
    {
        Booking booking = EmailPreviewSample.BookingFor(Location("not-a-time", "also-not"), Monday);

        Assert.Equal(new TimeSpan(19, 0, 0), booking.Date.TimeOfDay);
    }
}
