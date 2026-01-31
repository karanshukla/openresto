namespace OpenRestoApi.Core.Domain;

public class Booking
{
    public int Id { get; set; }
    public Table Table { get; set; } = null!;
    public Section Section { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
    public DateTime Date { get; set; }
    public string? CustomerEmail { get; set; }
    public int Seats { get; set; }
}
