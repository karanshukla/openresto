using System.Globalization;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Domain;

public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string OpenTime { get; set; } = "00:00";
    public string CloseTime { get; set; } = "23:59";

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

    // A restaurant can have multiple sections (e.g., indoor, patio)
    public ICollection<Section> Sections { get; set; } = new List<Section>();

    /// <summary>
    /// If set, new bookings are disabled until this time (UTC).
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
    /// Step, in minutes, between selectable booking start times in
    /// <see cref="Application.Services.AvailabilityService.GetAvailabilityAsync"/>.
    /// Decoupled from <see cref="DefaultBookingDurationMinutes"/> so a restaurant can
    /// offer, say, 90-minute bookings while still letting diners start every 15 minutes.
    /// Constrained to a small set (15/30/60) server-side; defaults to 30 to preserve the
    /// pre-setting behaviour (the old hardcoded slot step).
    /// </summary>
    public int BookingSlotIntervalMinutes { get; set; } = 30;

    /// <summary>
    /// True when online bookings are paused: a future <see cref="BookingsPausedUntil"/>
    /// is set. Consolidates the previously-inlined
    /// <c>BookingsPausedUntil.HasValue &amp;&amp; BookingsPausedUntil.Value &gt; DateTime.UtcNow</c>
    /// check that was duplicated across BookingService, HoldPolicyService, AvailabilityService,
    /// and AdminService.GetOverview.
    /// </summary>
    public bool IsPaused()
        => BookingsPausedUntil.HasValue && BookingsPausedUntil.Value > DateTime.UtcNow;

    /// <summary>
    /// True when the restaurant does not take online bookings on the local day of
    /// <paramref name="utc"/> — either globally (<see cref="WalkInOnly"/>) or because the
    /// resolved local ISO day is in <see cref="WalkInDays"/>. Delegates to
    /// <see cref="WalkInHelper.IsWalkInOnlyAt"/> for the timezone + ISO-day resolution.
    /// </summary>
    public bool IsWalkInOnlyAt(DateTime utc)
        => WalkInHelper.IsWalkInOnlyAt(this, utc);

    /// <summary>
    /// True when the restaurant is open at the given UTC instant. Resolves the local time
    /// via <see cref="Timezone"/>, checks <see cref="OpenDays"/> membership, and consults
    /// the per-day opening hours (with past-midnight wrap and 24h handling). Handles an
    /// unparseable <see cref="Timezone"/> by falling back to UTC. Mirrors the logic
    /// previously inlined as <c>HoldPolicyService.IsTimeWithinOpeningHours</c>.
    /// </summary>
    public bool IsOpenAt(DateTime utc)
    {
        DateTime localTime = TimeZoneHelper.ConvertUtcToLocal(utc, Timezone);

        int isoDay = (int)localTime.DayOfWeek;
        if (isoDay == 0)
        {
            isoDay = 7; // Sunday: 0 -> 7
        }

        // Check OpenDays
        if (!string.IsNullOrEmpty(OpenDays))
        {
            var openDaysList = OpenDays.Split(',').Select(s => s.Trim());
            if (!openDaysList.Contains(isoDay.ToString(CultureInfo.InvariantCulture)))
            {
                return false;
            }
        }

        (string openTime, string closeTime) = OpeningHoursHelper.GetHoursForDay(this, isoDay);
        if (!OpeningHoursHelper.TryParseTime(openTime, out int openHour, out int openMin))
        {
            openHour = 9; openMin = 0;
        }
        if (!OpeningHoursHelper.TryParseTime(closeTime, out int closeHour, out int closeMin))
        {
            closeHour = 22; closeMin = 0;
        }

        TimeSpan open = new TimeSpan(openHour, openMin, 0);
        TimeSpan close = new TimeSpan(closeHour, closeMin, 0);
        TimeSpan current = localTime.TimeOfDay;

        if (close > open)
        {
            return current >= open && current < close;
        }
        else if (close < open)
        {
            // Closes after midnight (e.g. 18:00 to 02:00)
            return current >= open || current < close;
        }
        else
        {
            // close == open usually means 24h
            return true;
        }
    }
}
