using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class MediaService(AppDbContext db, IWebHostEnvironment env)
{
    private readonly AppDbContext _db = db;
    private readonly string _mediaDir = Path.Combine(env.ContentRootPath, "wwwroot", "media");

    public virtual async Task<string> UploadHeroAsync(Stream fileStream, string contentType)
    {
        EnsureMediaDir();
        foreach (string old in Directory.GetFiles(_mediaDir, "hero.*"))
            System.IO.File.Delete(old);

        string filename = $"hero.{GetExtension(contentType)}";
        await using (FileStream dest = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
            await fileStream.CopyToAsync(dest);

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        BrandSettings? brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand == null)
        {
            brand = new BrandSettings();
            _db.Set<BrandSettings>().Add(brand);
        }
        brand.HeaderImageUrl = url;
        await _db.SaveChangesAsync();
        return url;
    }

    public virtual async Task DeleteHeroAsync()
    {
        BrandSettings? brand = await _db.Set<BrandSettings>().FirstOrDefaultAsync();
        if (brand?.HeaderImageUrl != null)
        {
            // Clear the persisted reference first so a missing/invalid physical file
            // never blocks removal. Best-effort deletion of the file on disk.
            string url = brand.HeaderImageUrl;
            brand.HeaderImageUrl = null;
            await _db.SaveChangesAsync();
            TryDeleteFile(url);
        }
    }

    public virtual async Task<string?> UploadLocationAsync(int id, Stream fileStream, string contentType)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null) return null;

        EnsureMediaDir();
        foreach (string old in Directory.GetFiles(_mediaDir, $"location-{id}.*"))
            System.IO.File.Delete(old);

        string filename = $"location-{id}.{GetExtension(contentType)}";
        await using (FileStream dest = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
            await fileStream.CopyToAsync(dest);

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        restaurant.ImageUrl = url;
        await _db.SaveChangesAsync();
        return url;
    }

    public virtual async Task<bool> DeleteLocationAsync(int id)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null) return false;
        if (restaurant.ImageUrl != null)
        {
            // Clear the persisted reference first so a missing/invalid physical file
            // never blocks removal. Best-effort deletion of the file on disk.
            string url = restaurant.ImageUrl;
            restaurant.ImageUrl = null;
            await _db.SaveChangesAsync();
            TryDeleteFile(url);
        }
        return true;
    }

    private void EnsureMediaDir() => Directory.CreateDirectory(_mediaDir);

    /// <summary>
    /// Best-effort physical file deletion. Never throws — used so that removing an
    /// image always succeeds even when the stored path is invalid, corrupt, or the
    /// underlying file has already been deleted.
    /// </summary>
    private void TryDeleteFile(string url)
    {
        try
        {
            string pathOnly = url.Contains('?') ? url[..url.IndexOf('?')] : url;
            string path = Path.Combine(_mediaDir, Path.GetFileName(pathOnly));
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);
        }
        catch
        {
            // Intentionally ignored: the DB reference has already been cleared,
            // so a stray/invalid physical file should not fail the removal.
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
