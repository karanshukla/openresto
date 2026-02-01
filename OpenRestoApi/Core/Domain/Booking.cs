namespace OpenRestoApi.Core.Domain;

public class Booking
{
    public int Id { get; set; }
    public Table Table { get; set; } = null!;
    public int TableId { get; set; }
    public Section Section { get; set; } = null!;
    public int SectionId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;
    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public string? CustomerEmail { get; set; }
    public int Seats { get; set; }
}
