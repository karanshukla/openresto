using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/media")]
[Authorize]
[EnableRateLimiting("public")]
public class MediaController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private readonly AppDbContext _db = db;
    private readonly string _mediaDir = Path.Combine(env.ContentRootPath, "wwwroot", "media");

    private static readonly string[] _allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    private const long _maxHeroBytes = 5 * 1024 * 1024;
    private const long _maxLocationBytes = 2 * 1024 * 1024;

    [HttpPost("hero")]
    [RequestSizeLimit(5 * 1024 * 1024 + 8192)]
    public async Task<IActionResult> UploadHero(IFormFile file)
    {
        if (!_allowedTypes.Contains(file.ContentType))
        {
            return BadRequest(new { message = "Only JPEG, PNG, and WebP images are accepted." });
        }

        if (file.Length > _maxHeroBytes)
        {
            return BadRequest(new { message = "Hero image must be under 5 MB." });
        }

        EnsureMediaDir();

        foreach (string old in Directory.GetFiles(_mediaDir, "hero.*"))
        {
            System.IO.File.Delete(old);
        }

        string filename = $"hero.{GetExtension(file.ContentType)}";
        await using (FileStream stream = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
        {
            await file.CopyToAsync(stream);
        }

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        BrandSettings? brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand == null)
        {
            brand = new BrandSettings();
            _db.Set<BrandSettings>().Add(brand);
        }
        brand.HeaderImageUrl = url;
        await _db.SaveChangesAsync();

        return Ok(new { url });
    }

    [HttpDelete("hero")]
    public async Task<IActionResult> DeleteHero()
    {
        BrandSettings? brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand?.HeaderImageUrl != null)
        {
            DeleteFile(brand.HeaderImageUrl);
            brand.HeaderImageUrl = null;
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpPost("location/{id:int}")]
    [RequestSizeLimit(2 * 1024 * 1024 + 8192)]
    public async Task<IActionResult> UploadLocation(int id, IFormFile file)
    {
        if (!_allowedTypes.Contains(file.ContentType))
        {
            return BadRequest(new { message = "Only JPEG, PNG, and WebP images are accepted." });
        }

        if (file.Length > _maxLocationBytes)
        {
            return BadRequest(new { message = "Location image must be under 2 MB." });
        }

        Core.Domain.Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null)
        {
            return NotFound();
        }

        EnsureMediaDir();

        foreach (string old in Directory.GetFiles(_mediaDir, $"location-{id}.*"))
        {
            System.IO.File.Delete(old);
        }

        string filename = $"location-{id}.{GetExtension(file.ContentType)}";
        await using (FileStream stream = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
        {
            await file.CopyToAsync(stream);
        }

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        restaurant.ImageUrl = url;
        await _db.SaveChangesAsync();

        return Ok(new { url });
    }

    [HttpDelete("location/{id:int}")]
    public async Task<IActionResult> DeleteLocation(int id)
    {
        Core.Domain.Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null)
        {
            return NotFound();
        }

        if (restaurant.ImageUrl != null)
        {
            DeleteFile(restaurant.ImageUrl);
            restaurant.ImageUrl = null;
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    private void EnsureMediaDir() => Directory.CreateDirectory(_mediaDir);

    private void DeleteFile(string url)
    {
        string pathOnly = url.Contains('?') ? url[..url.IndexOf('?')] : url;
        string path = Path.Combine(_mediaDir, Path.GetFileName(pathOnly));
        if (System.IO.File.Exists(path))
        {
            System.IO.File.Delete(path);
        }
    }

    private static string GetExtension(string contentType) => contentType switch
    {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "bin"
    };
}
