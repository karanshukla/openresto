using System.Text.RegularExpressions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BrandService(IBrandSettingsRepository brandRepository, IConfiguration configuration)
{
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IConfiguration _configuration = configuration;

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

    private static readonly HashSet<string> _validFaviconIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        "utensils", "wine", "coffee", "pizza", "flame",
        "leaf", "star", "heart", "chef-hat", "fish"
    };

    public async Task SaveAsync(
        string? appName,
        string? primaryColor,
        string? accentColor,
        string? faviconIcon = null,
        string? websiteUrl = null,
        string? copyrightText = null)
    {
        if (appName != null && appName.Length > 32)
        {
            throw new ArgumentException("App name cannot exceed 32 characters.");
        }

        if (primaryColor != null && !IsValidHexColor(primaryColor))
        {
            throw new ArgumentException("Invalid primary color hex code.");
        }

        if (accentColor != null && !IsValidHexColor(accentColor))
        {
            throw new ArgumentException("Invalid accent color hex code.");
        }

        if (faviconIcon != null && !_validFaviconIcons.Contains(faviconIcon))
        {
            throw new ArgumentException("Invalid favicon icon.");
        }

        if (copyrightText != null && copyrightText.Length > 200)
        {
            throw new ArgumentException("Copyright text cannot exceed 200 characters.");
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
