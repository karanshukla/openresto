using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Domain;

public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string OpenTime { get; set; } = OpeningHourDefaults.Open;
    public string CloseTime { get; set; } = OpeningHourDefaults.Close;

    /// <summary>
    /// Comma-separated day numbers (ISO 8601: 1=Monday, 7=Sunday).
    /// Default: all days open. Example: "1,2,3,4,5" = weekdays only.
    /// </summary>
    public string OpenDays { get; set; } = "1,2,3,4,5,6,7";

    /// <summary>
    /// Optional per-day opening hour overrides as JSON keyed by ISO day number,
    /// e.g. {"1":{"open":"12:00","close":"22:00"}}. Null means every day uses
    /// OpenTime/CloseTime. Days missing from the JSON also fall back to them.
    /// </summary>
    public string? OpenHoursJson { get; set; }

    /// <summary>
    /// IANA timezone identifier (e.g. "Europe/London", "America/New_York").
    /// All booking times are interpreted in this timezone.
    /// </summary>
    public string Timezone { get; set; } = "UTC";

    public ICollection<Section> Sections { get; set; } = new List<Section>();

    public ICollection<TableGroup> Groups { get; set; } = new List<TableGroup>();

    /// <summary>
    /// If set, sittings that start before this instant (UTC) are closed to new bookings.
    /// </summary>
    public DateTime? BookingsPausedUntil { get; set; }

    public string? Tags { get; set; }

    public string? ImageUrl { get; set; }

    /// <summary>
    /// Optional freeform blurb shown on the public location detail page. Supports basic
    /// markdown-style inline links (e.g. "See our [menu](https://example.com/menu)").
    /// Null/empty hides the blurb entirely.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional link to this location's menu — a PDF, a page on their site, wherever it
    /// lives. Null/empty hides the "View menu" affordance on the location page.
    /// </summary>
    public string? MenuUrl { get; set; }

    /// <summary>
    /// Optional contact phone number for this location. Overrides
    /// <see cref="BrandSettings.PhoneNumber"/> wherever a contact is surfaced.
    /// Null/empty falls back to the global value.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Optional contact email address for this location. Overrides
    /// <see cref="BrandSettings.EmailAddress"/>. Null/empty falls back to the global value.
    /// </summary>
    public string? EmailAddress { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>
    /// When true the location accepts walk-ins only: it stays listed publicly
    /// but online bookings (and holds) are rejected for every day.
    /// </summary>
    public bool WalkInOnly { get; set; }

    /// <summary>
    /// Comma-separated ISO day numbers (1=Monday … 7=Sunday) on which the
    /// location accepts walk-ins only. Ignored when <see cref="WalkInOnly"/>
    /// is true (the whole week is walk-in only). Null/empty means bookings
    /// are accepted on every open day.
    /// </summary>
    public string? WalkInDays { get; set; }

    /// <summary>
    /// Length, in minutes, of a single table's occupancy window for a new booking.
    /// Used wherever a booking's end time is computed (creation, availability, holds).
    /// </summary>
    public int DefaultBookingDurationMinutes { get; set; } = 60;

    /// <summary>
    /// Step, in minutes, between selectable booking start times. Deliberately independent of
    /// <see cref="DefaultBookingDurationMinutes"/>, so a restaurant can offer 90-minute
    /// sittings that still start every 15 minutes. Constrained to 15/30/60 server-side.
    /// </summary>
    public int BookingSlotIntervalMinutes { get; set; } = 30;

    /// <summary>
    /// When set, the largest number of spare seats a table may carry over the party size and
    /// still be offered — a table qualifies while
    /// <c>table.Seats - partySize &lt;= MaxTableOversizeSeats</c>. Null is unrestricted. It has
    /// to be applied identically in availability, booking creation/update and auto-assign, or
    /// the customer is offered a table the server will then refuse. Admin-recorded walk-ins
    /// are intentionally exempt.
    /// </summary>
    public int? MaxTableOversizeSeats { get; set; }

    /// <summary>
    /// True when a bookable unit of <paramref name="unitSeats"/> seats — a table or a
    /// combinable group — may take a party of <paramref name="partySize"/>: large enough to
    /// seat them, and not so much larger that <see cref="MaxTableOversizeSeats"/> would rather
    /// hold it for a bigger group.
    /// </summary>
    /// <seealso>RestaurantTests.CanSeat_True_WhenTheUnitIsExactlyAtTheOversizeCap</seealso>
    /// <seealso>RestaurantTests.CanSeat_False_WhenTheUnitIsOneSeatOverTheCap</seealso>
    public bool CanSeat(int unitSeats, int partySize)
        => unitSeats >= partySize && !ExceedsOversizeCap(unitSeats, partySize);

    /// <summary>
    /// The upper half of <see cref="CanSeat"/>, for the paths that reject a too-small unit
    /// with their own message and only need the cap. Availability, holds, booking
    /// creation/update and auto-assign must all answer this identically: a path that is more
    /// permissive offers the customer a table the next one then refuses.
    /// </summary>
    public bool ExceedsOversizeCap(int unitSeats, int partySize)
        => MaxTableOversizeSeats.HasValue && unitSeats - partySize > MaxTableOversizeSeats.Value;

    /// <summary>
    /// Shape of the booking references handed to this location's customers. Only consulted
    /// when a reference is minted, so changing it leaves already-issued references alone.
    /// </summary>
    public BookingRefFormat BookingRefFormat { get; set; } = BookingRefFormat.AlphaNumeric;

    /// <summary>True while a pause is running — for badges and counts, not as a booking gate.</summary>
    public bool IsPaused()
        => BookingsPausedUntil.HasValue && BookingsPausedUntil.Value > DateTime.UtcNow;

    /// <summary>
    /// The booking gate: true when a sitting starting at <paramref name="bookingUtc"/> falls
    /// inside the active pause window. Pausing means "stop seating new arrivals for the next
    /// X hours", so next Saturday stays bookable while tonight's service is paused.
    /// </summary>
    /// <seealso>RestaurantTests.IsPausedFor_True_WhenTheSittingStartsInsideThePauseWindow</seealso>
    /// <seealso>RestaurantTests.IsPausedFor_False_WhenTheSittingStartsAfterThePauseWindow</seealso>
    public bool IsPausedFor(DateTime bookingUtc)
        => IsPaused() && bookingUtc < BookingsPausedUntil!.Value;

    public bool IsWalkInOnlyAt(DateTime utc)
        => WalkInHelper.IsWalkInOnlyAt(this, utc);

    /// <summary>
    /// True when the restaurant is open at the given UTC instant, resolved through
    /// <see cref="Timezone"/> — which falls back to UTC when it is not a known IANA id.
    /// </summary>
    /// <seealso>RestaurantTests.IsOpenAt_True_ForOvernightWindow_AfterMidnightClose</seealso>
    /// <seealso>RestaurantTests.IsOpenAt_False_ForOvernightWindow_OutsideBothSegments</seealso>
    public bool IsOpenAt(DateTime utc)
    {
        DateTime localTime = TimeZoneHelper.ConvertUtcToLocal(utc, Timezone);
        int isoDay = IsoDay.Of(localTime);

        if (!IsOpenOn(isoDay))
        {
            return false;
        }

        (TimeSpan open, TimeSpan close) = ServiceWindowOn(isoDay);
        return Covers(open, close, localTime.TimeOfDay);
    }

    private bool IsOpenOn(int isoDay)
    {
        HashSet<int> openDays = IsoDay.ParseList(OpenDays);
        return openDays.Count == 0 || openDays.Contains(isoDay);
    }

    private (TimeSpan Open, TimeSpan Close) ServiceWindowOn(int isoDay)
    {
        (string openTime, string closeTime) = OpeningHoursHelper.GetHoursForDay(this, isoDay);

        if (!OpeningHoursHelper.TryParseTime(openTime, out int openHour, out int openMin))
        {
            (openHour, openMin) = OpeningHourDefaults.OpenAt;
        }

        if (!OpeningHoursHelper.TryParseTime(closeTime, out int closeHour, out int closeMin))
        {
            (closeHour, closeMin) = OpeningHourDefaults.CloseAt;
        }

        return (new TimeSpan(openHour, openMin, 0), new TimeSpan(closeHour, closeMin, 0));
    }

    private static bool Covers(TimeSpan open, TimeSpan close, TimeSpan timeOfDay)
    {
        bool openAllDay = open == close;
        if (openAllDay)
        {
            return true;
        }

        bool closesAfterMidnight = close < open;
        return closesAfterMidnight
            ? timeOfDay >= open || timeOfDay < close
            : timeOfDay >= open && timeOfDay < close;
    }
}
