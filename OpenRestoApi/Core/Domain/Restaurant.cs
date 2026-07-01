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

    public bool IsArchived { get; set; }

    /// <summary>
    /// Length, in minutes, of a single table's occupancy window for a new booking.
    /// Used wherever a booking's end time is computed (creation, availability, holds).
    /// </summary>
    public int DefaultBookingDurationMinutes { get; set; } = 60;
}
