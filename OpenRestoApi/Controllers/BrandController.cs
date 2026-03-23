using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/brand")]
public class BrandController : ControllerBase
{
    private readonly AppDbContext _db;
    private const int MaxLogoBytes = 256 * 1024; // 256 KB

    public BrandController(AppDbContext db) => _db = db;

    /// <summary>Public endpoint — returns brand config with aggressive caching.</summary>
    [HttpGet]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get()
    {
        var brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        return Ok(new BrandResponse
        {
            AppName = brand?.AppName ?? "Open Resto",
            PrimaryColor = brand?.PrimaryColor ?? "#0a7ea4",
            AccentColor = brand?.AccentColor,
            LogoUrl = brand?.LogoBase64,
        });
    }

    /// <summary>Admin-only — update brand settings.</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Save([FromBody] BrandRequest req)
    {
        // Validate logo size
        if (req.LogoBase64 != null)
        {
            var commaIdx = req.LogoBase64.IndexOf(',');
            var base64Part = commaIdx >= 0 ? req.LogoBase64[(commaIdx + 1)..] : req.LogoBase64;
            var sizeBytes = (int)(base64Part.Length * 0.75);
            if (sizeBytes > MaxLogoBytes)
            {
                return BadRequest(new { message = $"Logo must be under {MaxLogoBytes / 1024} KB." });
            }
        }

        var brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand == null)
        {
            brand = new BrandSettings();
            _db.Set<BrandSettings>().Add(brand);
        }

        brand.AppName = req.AppName ?? brand.AppName;
        brand.PrimaryColor = req.PrimaryColor ?? brand.PrimaryColor;
        brand.AccentColor = req.AccentColor;

        // Only update logo if explicitly provided (null = no change, empty = remove)
        if (req.LogoBase64 != null)
        {
            brand.LogoBase64 = req.LogoBase64 == "" ? null : req.LogoBase64;
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Brand settings saved." });
    }
}

public class BrandRequest
{
    public string? AppName { get; set; }
    public string? PrimaryColor { get; set; }
    public string? AccentColor { get; set; }
    /// <summary>Data URL or empty string to remove. Null = no change.</summary>
    public string? LogoBase64 { get; set; }
}

public class BrandResponse
{
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }
    public string? LogoUrl { get; set; }
}
