namespace OpenRestoApi.Core.Domain;

public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string OpenTime { get; set; } = "09:00";
    public string CloseTime { get; set; } = "22:00";

    /// <summary>
    /// Comma-separated day numbers (ISO 8601: 1=Monday, 7=Sunday).
    /// Default: all days open. Example: "1,2,3,4,5" = weekdays only.
    /// </summary>
    public string OpenDays { get; set; } = "1,2,3,4,5,6,7";

    /// <summary>
    /// IANA timezone identifier (e.g. "Europe/London", "America/New_York").
    /// All booking times are interpreted in this timezone.
    /// </summary>
    public string Timezone { get; set; } = "UTC";

    // A restaurant can have multiple sections (e.g., indoor, patio)
    public ICollection<Section> Sections { get; set; } = new List<Section>();
}
