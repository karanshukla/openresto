namespace OpenRestoApi.Core.Application.DTOs;

public class PlaceHoldRequest
{
    public int RestaurantId { get; set; }

    /// <summary>
    /// Specific table to hold. When null (and <see cref="SectionId"/> is also null), the
    /// server auto-assigns the best available table across all sections ("Any section" flow).
    /// </summary>
    public int? TableId { get; set; }

    /// <summary>
    /// Specific section of <see cref="TableId"/>. When null (and <see cref="TableId"/> is
    /// also null), the server auto-assigns. Must be provided whenever <see cref="TableId"/> is.
    /// </summary>
    public int? SectionId { get; set; }

    /// <summary>
    /// Combinable-table group to hold (#272). When set, the server resolves the group's members and
    /// places a single hold reserving all of them. Mutually exclusive with <see cref="TableId"/>.
    /// </summary>
    public int? TableGroupId { get; set; }

    /// <summary>
    /// Party size. Required for auto-assign and group holds (so the server can validate capacity);
    /// ignored for explicit-table holds (the capacity check happens at booking time).
    /// </summary>
    public int Seats { get; set; }

    /// <summary>Full ISO 8601 datetime of the intended booking.</summary>
    public DateTime Date { get; set; }

    /// <summary>If the caller already holds this ID, the backend atomically replaces it.</summary>
    public string? CurrentHoldId { get; set; }
}

public class HoldResponse
{
    public string HoldId { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Resolved table for auto-assigned holds ("Any section"). Null for explicit-table holds
    /// where the caller already knows the table.
    /// </summary>
    public int? TableId { get; set; }

    /// <summary>
    /// Resolved section for auto-assigned holds ("Any section"). Null for explicit-table holds.
    /// </summary>
    public int? SectionId { get; set; }

    /// <summary>
    /// Resolved combinable-table group for group holds (#272). Null for single-table/auto holds.
    /// </summary>
    public int? TableGroupId { get; set; }

    /// <summary>Seconds until the hold expires, for countdown display.</summary>
    public int SecondsRemaining => Math.Max(0, (int)(ExpiresAt - DateTime.UtcNow).TotalSeconds);
}
