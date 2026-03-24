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
}
