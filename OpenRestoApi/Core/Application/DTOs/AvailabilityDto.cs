namespace OpenRestoApi.Core.Application.DTOs;

public class TimeSlotDto
{
    public string Time { get; set; } = string.Empty; // e.g. "12:15"
    public bool IsAvailable { get; set; }
    public List<int> AvailableTableIds { get; set; } = new();

    /// <summary>
    /// Combinable-table group ids (#272) bookable for this slot — a group is listed when its
    /// <c>CombinedSeats</c> fits the party, the oversize cap is satisfied, and every member table is
    /// free (no booking conflict, no hold) for the slot's duration. Parallel to
    /// <see cref="AvailableTableIds"/> rather than overloading it so the two id spaces stay distinct.
    /// </summary>
    public List<int> AvailableGroupIds { get; set; } = new();

    public string Category { get; set; } = "Off-Peak"; // "Lunch", "Dinner", or "Off-Peak"
}

public class AvailabilityResponseDto
{
    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public List<TimeSlotDto> Slots { get; set; } = new();
}
