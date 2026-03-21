namespace OpenRestoApi.Core.Application.DTOs;

public class BookingDto
{
    public int Id { get; set; }
    public int TableId { get; set; }
    public int SectionId { get; set; }
    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public string? CustomerEmail { get; set; }
    public int Seats { get; set; }
    public bool isHeld { get; set; } = false;

    /// <summary>
    /// Optional hold ID obtained from POST /api/holds.
    /// Provide this when creating a booking to validate and consume the hold.
    /// Not returned in responses.
    /// </summary>
    public string? HoldId { get; set; }
}
