namespace OpenRestoApi.Core.Domain;

public class EmailFailure
{
    public int Id { get; set; }
    public string? BookingRef { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
}
