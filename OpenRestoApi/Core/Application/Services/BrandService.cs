using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class BrandService(AppDbContext db, IConfiguration configuration)
{
    private readonly AppDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;

    private static bool IsValidHexColor(string color)
    {
        return Regex.IsMatch(color, @"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$");
    }

    public string GetWebsiteUrl()
    {
        return _configuration["Website:Url"]
               ?? Environment.GetEnvironmentVariable("WEBSITE_URL")
               ?? "http://localhost:8081";
    }

    public async Task<BrandSettings> GetAsync()
    {
        return await _db.Set<BrandSettings>().FirstOrDefaultAsync()
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

    public async Task SaveAsync(string? appName, string? primaryColor, string? accentColor, string? faviconIcon = null)
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

        BrandSettings? brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand == null)
        {
            brand = new BrandSettings();
            _db.Set<BrandSettings>().Add(brand);
        }

        brand.AppName = appName ?? brand.AppName;
        brand.PrimaryColor = primaryColor ?? brand.PrimaryColor;
        brand.AccentColor = accentColor;
        if (faviconIcon != null)
        {
            brand.FaviconIcon = faviconIcon;
        }

        await _db.SaveChangesAsync();
    }
}
