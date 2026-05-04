namespace OpenRestoApi.Core.Application.DTOs;

public class TimeSlotDto
{
    public string Time { get; set; } = string.Empty; // e.g. "12:15"
    public bool IsAvailable { get; set; }
    public List<int> AvailableTableIds { get; set; } = new();
    public string Category { get; set; } = "Off-Peak"; // "Lunch", "Dinner", or "Off-Peak"
}

public class AvailabilityResponseDto
{
    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public List<TimeSlotDto> Slots { get; set; } = new();
}
