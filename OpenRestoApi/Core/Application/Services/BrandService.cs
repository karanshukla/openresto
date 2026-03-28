using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class BrandService(AppDbContext db)
{
    private readonly AppDbContext _db = db;
    private const int MaxLogoBytes = 256 * 1024; // 256 KB

    private static bool IsValidHexColor(string color)
    {
        return Regex.IsMatch(color, @"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$");
    }

    public async Task<BrandSettings> GetAsync()
    {
        return await _db.Set<BrandSettings>().FirstOrDefaultAsync()
            ?? new BrandSettings { AppName = "Open Resto", PrimaryColor = "#0a7ea4" };
    }

    public async Task SaveAsync(string? appName, string? primaryColor, string? accentColor, string? logoBase64)
    {
        if (primaryColor != null && !IsValidHexColor(primaryColor))
        {
            throw new ArgumentException("Invalid primary color hex code.");
        }

        if (accentColor != null && !IsValidHexColor(accentColor))
        {
            throw new ArgumentException("Invalid accent color hex code.");
        }

        if (logoBase64 != null)
        {
            int commaIdx = logoBase64.IndexOf(',');
            string base64Part = commaIdx >= 0 ? logoBase64[(commaIdx + 1)..] : logoBase64;
            int sizeBytes = (int)(base64Part.Length * 0.75);
            if (sizeBytes > MaxLogoBytes)
            {
                throw new ArgumentException($"Logo must be under {MaxLogoBytes / 1024} KB.");
            }
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

        if (logoBase64 != null)
        {
            brand.LogoBase64 = logoBase64 == "" ? null : logoBase64;
        }

        await _db.SaveChangesAsync();
    }
}
