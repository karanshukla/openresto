namespace OpenRestoApi.Core.Domain;

public class EmailSettings
{
    public int Id { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string EncryptedPassword { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public bool SendBookingConfirmations { get; set; }

    /// <summary>
    /// Email the location (its contact address, falling back to the brand's) whenever a booking
    /// is created or cancelled, alongside the admin Web Push. Off by default.
    /// </summary>
    public bool SendRestaurantBookingAlerts { get; set; }
}
