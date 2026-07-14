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

    /// <summary>
    /// Short tagline shown under <see cref="AppName"/> on the home page, in place of the
    /// hard-coded default subheading. Null falls back to the default copy.
    /// </summary>
    [StringLength(160)]
    public string? Subtitle { get; set; }

    /// <summary>
    /// Optional heading text above the home page highlights section
    /// (defaults to "Restaurant highlights" when null).
    /// </summary>
    [StringLength(60)]
    public string? HighlightsHeading { get; set; }

    /// <summary>
    /// Optional subheading text above the home page highlights section
    /// (defaults to "Curated by the owner" when null).
    /// </summary>
    [StringLength(60)]
    public string? HighlightsSubheading { get; set; }

    /// <summary>
    /// How the home page hero image is fit into its frame. Null/"Cover" (the default)
    /// keeps today's behaviour; "Contain" shows the whole image. See <see cref="HeaderImageFit"/>.
    /// </summary>
    [StringLength(10)]
    public string? HeaderImageFit { get; set; }
}
