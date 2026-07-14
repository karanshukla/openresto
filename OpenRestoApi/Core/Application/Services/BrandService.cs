using System.Text.RegularExpressions;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BrandService(IBrandSettingsRepository brandRepository, IConfiguration configuration)
{
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IConfiguration _configuration = configuration;

    /// <summary>Permitted values for <see cref="BrandSettings.HeaderImageFit"/> (case-insensitive).</summary>
    public static readonly HashSet<string> AllowedHeaderImageFits =
        new(StringComparer.OrdinalIgnoreCase) { "Cover", "Contain" };

    private static bool IsValidHexColor(string color)
    {
        return Regex.IsMatch(color, @"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$");
    }

    public string GetWebsiteUrl(BrandSettings? brand = null)
    {
        if (!string.IsNullOrWhiteSpace(brand?.WebsiteUrl))
            return brand.WebsiteUrl;

        string? explicit_ = _configuration["Website:Url"] ?? Environment.GetEnvironmentVariable("WEBSITE_URL");
        if (!string.IsNullOrWhiteSpace(explicit_))
            return explicit_;

        // Fall back to the first CORS origin — self-hosters already set this to their public domain
        string? corsOrigins = _configuration["Cors:Origins"] ?? Environment.GetEnvironmentVariable("CORS_ORIGINS");
        if (!string.IsNullOrWhiteSpace(corsOrigins))
        {
            string first = corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0];
            if (!string.IsNullOrWhiteSpace(first))
                return first;
        }

        return "http://localhost:8081";
    }

    public async Task<string> GetWebsiteUrlAsync()
    {
        BrandSettings? brand = await _brandRepository.GetAsync();
        return GetWebsiteUrl(brand);
    }

    public async Task<BrandSettings> GetAsync()
    {
        return await _brandRepository.GetAsync()
            ?? new BrandSettings
            {
                AppName = "Open Resto",
                PrimaryColor = "#0a7ea4"
            };
    }

    public async Task SaveAsync(
        string? appName,
        string? primaryColor,
        string? accentColor,
        string? faviconIcon = null,
        string? websiteUrl = null,
        string? copyrightText = null,
        string? subtitle = null,
        string? highlightsHeading = null,
        string? highlightsSubheading = null,
        string? headerImageFit = null)
    {
        if (appName != null && appName.Length > 32)
        {
            throw new ValidationException("App name cannot exceed 32 characters.");
        }

        if (primaryColor != null && !IsValidHexColor(primaryColor))
        {
            throw new ValidationException("Invalid primary color hex code.");
        }

        if (accentColor != null && !IsValidHexColor(accentColor))
        {
            throw new ValidationException("Invalid accent color hex code.");
        }

        if (faviconIcon != null && LucideIconPaths.Get(faviconIcon) == null)
        {
            throw new ValidationException("Invalid favicon icon.");
        }

        if (copyrightText != null && copyrightText.Length > 200)
        {
            throw new ValidationException("Copyright text cannot exceed 200 characters.");
        }

        if (subtitle != null && subtitle.Length > 160)
        {
            throw new ValidationException("Subtitle cannot exceed 160 characters.");
        }

        if (highlightsHeading != null && highlightsHeading.Length > 60)
        {
            throw new ValidationException("Highlights heading cannot exceed 60 characters.");
        }

        if (highlightsSubheading != null && highlightsSubheading.Length > 60)
        {
            throw new ValidationException("Highlights subheading cannot exceed 60 characters.");
        }

        // Empty string clears the fit (falls back to the default "Cover"); a non-empty value
        // must be one of the allowed modes. Null leaves the stored value untouched.
        if (headerImageFit != null
            && !string.IsNullOrWhiteSpace(headerImageFit)
            && !AllowedHeaderImageFits.Contains(headerImageFit))
        {
            throw new ValidationException(
                $"HeaderImageFit must be one of: {string.Join(", ", AllowedHeaderImageFits.Order())}.");
        }

        BrandSettings? brand = await _brandRepository.GetAsync();
        bool isNew = false;
        if (brand == null)
        {
            brand = new BrandSettings();
            isNew = true;
        }

        brand.AppName = appName ?? brand.AppName;
        brand.PrimaryColor = primaryColor ?? brand.PrimaryColor;
        brand.AccentColor = accentColor;
        if (faviconIcon != null)
        {
            brand.FaviconIcon = faviconIcon;
        }
        if (websiteUrl != null)
        {
            brand.WebsiteUrl = string.IsNullOrWhiteSpace(websiteUrl) ? null : websiteUrl.Trim();
        }
        if (copyrightText != null)
        {
            brand.CopyrightText = string.IsNullOrWhiteSpace(copyrightText) ? null : copyrightText.Trim();
        }
        if (subtitle != null)
        {
            brand.Subtitle = string.IsNullOrWhiteSpace(subtitle) ? null : subtitle.Trim();
        }
        if (highlightsHeading != null)
        {
            brand.HighlightsHeading = string.IsNullOrWhiteSpace(highlightsHeading) ? null : highlightsHeading.Trim();
        }
        if (highlightsSubheading != null)
        {
            brand.HighlightsSubheading = string.IsNullOrWhiteSpace(highlightsSubheading) ? null : highlightsSubheading.Trim();
        }
        // HeaderImageFit: blank/whitespace clears to null (→ default Cover). Normalize casing
        // of the allowed value (e.g. "contain" → "Contain") so persisted data is canonical.
        if (headerImageFit != null)
        {
            if (string.IsNullOrWhiteSpace(headerImageFit))
            {
                brand.HeaderImageFit = null;
            }
            else
            {
                brand.HeaderImageFit = AllowedHeaderImageFits.First(f =>
                    f.Equals(headerImageFit, StringComparison.OrdinalIgnoreCase));
            }
        }

        if (isNew)
        {
            await _brandRepository.AddAsync(brand);
        }
        else
        {
            await _brandRepository.SaveChangesAsync();
        }
    }
}
