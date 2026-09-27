namespace OpenRestoApi.Core.Domain;

public class AdminNotification
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;
    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public string BookingRef { get; set; } = string.Empty;

    // "BookingCreated" | "BookingCancelled"
    public string Type { get; set; } = string.Empty;

    // Denormalized so the record survives booking/restaurant edits
    public string CustomerName { get; set; } = string.Empty;
    public DateTime BookingDate { get; set; }
    public int Seats { get; set; }
    public string RestaurantName { get; set; } = string.Empty;

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PushSentAt { get; set; }
    public string? PushError { get; set; }
}
