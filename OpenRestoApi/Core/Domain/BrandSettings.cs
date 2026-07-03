using System.ComponentModel.DataAnnotations;

namespace OpenRestoApi.Core.Domain;

public class BrandSettings
{
    public int Id { get; set; }

    [StringLength(32)]
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }

    public string? HeaderImageUrl { get; set; }

    [StringLength(32)]
    public string? FaviconIcon { get; set; }

    public string? WebsiteUrl { get; set; }

    [StringLength(200)]
    public string? CopyrightText { get; set; }
}
