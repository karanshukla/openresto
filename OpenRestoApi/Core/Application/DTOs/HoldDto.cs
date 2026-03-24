namespace OpenRestoApi.Core.Application.DTOs;

public class PlaceHoldRequest
{
    public int RestaurantId { get; set; }
    public int TableId { get; set; }
    public int SectionId { get; set; }
    /// <summary>Full ISO 8601 datetime of the intended booking.</summary>
    public DateTime Date { get; set; }
}

public class HoldResponse
{
    public string HoldId { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    /// <summary>Seconds until the hold expires, for countdown display.</summary>
    public int SecondsRemaining => Math.Max(0, (int)(ExpiresAt - DateTime.UtcNow).TotalSeconds);
}
