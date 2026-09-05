using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The stand-in booking the admin's confirmation-email preview renders. It carries no persisted
/// row and is never saved: it exists so the real template can be run against a location's own
/// branding, hours, reference format and floor plan without a diner having booked anything.
/// </summary>
public static class EmailPreviewSample
{
    public const string CustomerName = "Alex Morgan";
    public const string CustomerEmail = "alex.morgan@example.com";
    public const string SpecialRequests = "Window table if one is free. We're celebrating an anniversary.";
    public const int Seats = 2;

    /// <summary>
    /// The hour the sample sitting prefers, when the location's service that day reaches it.
    /// A dinner sitting is what most confirmations are, and it exercises the template's longer
    /// time range; a lunch-only location gets its own opening time instead.
    /// </summary>
    public const int PreferredHour = 19;

    /// <summary>
    /// Fixed rather than generated, so refreshing the preview does not reshuffle the reference
    /// under the admin. Both shapes are real ones — see <see cref="BookingRefGenerator"/> and
    /// <see cref="NumericBookingRefGenerator"/>.
    /// </summary>
    public static string RefFor(BookingRefFormat format) => format switch
    {
        BookingRefFormat.Numeric => "48273910",
        _ => "golden-basil-thyme-0482"
    };

    /// <summary>
    /// Stands in for a location on an instance that has none yet, so the preview still shows the
    /// brand colour, header and footer rather than failing. Id 0 marks it as unsaved.
    /// </summary>
    public static Restaurant PlaceholderRestaurant => new()
    {
        Name = "Your Restaurant",
        Address = "1 Example Street, Your Town",
        Timezone = "UTC",
    };

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>EmailPreviewSampleTests.BookingFor_SkipsForwardToTheNextDayTheLocationOpens</seealso>
    /// <seealso>EmailPreviewSampleTests.BookingFor_SitsAtSevenWhenTheDaysServiceReachesIt</seealso>
    /// <seealso>EmailPreviewSampleTests.BookingFor_SitsAtOpeningTimeWhenServiceEndsBeforeSeven</seealso>
    /// <seealso>EmailPreviewSampleTests.BookingFor_TakesTheFirstTableOfTheFirstSection</seealso>
    public static Booking BookingFor(Restaurant restaurant, DateTime nowUtc)
    {
        DateTime localStart = NextSittingLocal(restaurant, nowUtc);
        DateTime startUtc = TimeZoneHelper.ConvertLocalToUtc(
            DateTime.SpecifyKind(localStart, DateTimeKind.Unspecified), restaurant.Timezone);

        Section? section = restaurant.Sections.OrderBy(s => s.SortOrder).FirstOrDefault();
        Table? table = section?.Tables.OrderBy(t => t.Id).FirstOrDefault();

        return new Booking
        {
            RestaurantId = restaurant.Id,
            Restaurant = restaurant,
            BookingRef = RefFor(restaurant.BookingRefFormat),
            CustomerName = CustomerName,
            CustomerEmail = CustomerEmail,
            SpecialRequests = SpecialRequests,
            Seats = Seats,
            Section = section,
            SectionId = section?.Id,
            Table = table,
            TableId = table?.Id,
            Date = startUtc,
            EndTime = startUtc.AddMinutes(restaurant.DefaultBookingDurationMinutes),
        };
    }

    private static DateTime NextSittingLocal(Restaurant restaurant, DateTime nowUtc)
    {
        DateTime day = TimeZoneHelper.ConvertUtcToLocal(nowUtc, restaurant.Timezone).Date.AddDays(1);

        // An OpenDays naming no recognisable day means every day (ServiceWindowHelper.IsOpenOn),
        // and anything it does name is inside 1..7, so a week's walk always lands on an open day.
        // The bound is there so a future change to that reading cannot spin the request forever.
        for (int ahead = 0; ahead < 7 && !ServiceWindowHelper.IsOpenOn(restaurant, IsoDay.Of(day)); ahead++)
        {
            day = day.AddDays(1);
        }

        return day.AddMinutes(StartMinutesOfDay(restaurant, IsoDay.Of(day)));
    }

    private static int StartMinutesOfDay(Restaurant restaurant, int isoDay)
    {
        (string open, string close) = OpeningHoursHelper.GetHoursForDay(restaurant, isoDay);
        if (!OpeningHoursHelper.TryParseTime(open, out int openHour, out int openMinute)
            || !OpeningHoursHelper.TryParseTime(close, out int closeHour, out int closeMinute))
        {
            return PreferredHour * 60;
        }

        int openMinutes = (openHour * 60) + openMinute;
        int closeMinutes = (closeHour * 60) + closeMinute;
        // A close earlier than the open runs past midnight, so the service is measured forward
        // from the open rather than as a difference between two times of day.
        int serviceLength = closeMinutes > openMinutes
            ? closeMinutes - openMinutes
            : (1440 - openMinutes) + closeMinutes;

        int preferredOffset = (((PreferredHour * 60) - openMinutes) + 1440) % 1440;
        return preferredOffset < serviceLength ? openMinutes + preferredOffset : openMinutes;
    }
}
