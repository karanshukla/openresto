using System.ComponentModel.DataAnnotations;

namespace OpenRestoApi.Core.Domain;

public class BrandSettings
{
    public int Id { get; set; }

    [StringLength(32)]
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }

    /// <summary>Base64-encoded logo image (max ~256 KB). Stored as a data URL, e.g. "data:image/png;base64,..."</summary>
    public string? LogoBase64 { get; set; }
}
