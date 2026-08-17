using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class MediaService(
    IBrandSettingsRepository brandRepository,
    IRestaurantRepository restaurantRepository,
    IWebHostEnvironment env,
    IAuditScope? audit = null)
{
    /// <summary>
    /// Castle's generated proxy constructors do not carry default values, so a Moq class mock can
    /// only reach a constructor whose arity it matches exactly. This is the arity it passes.
    /// </summary>
    public MediaService(
        IBrandSettingsRepository brand,
        IRestaurantRepository restaurants,
        IWebHostEnvironment hostEnvironment)
        : this(brand, restaurants, hostEnvironment, null) { }

    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
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

        BrandSettings? brand = await _brandRepository.GetAsync();
        bool isNew = false;
        if (brand == null)
        {
            brand = new BrandSettings();
            isNew = true;
        }
        brand.HeaderImageUrl = url;

        if (isNew)
        {
            await _brandRepository.AddAsync(brand);
        }
        else
        {
            await _brandRepository.SaveChangesAsync();
        }

        DescribeMedia(AuditActions.MediaUpload, HeroSlot, "Homepage header image", null,
            "Uploaded a new homepage header image");
        return url;
    }

    public virtual async Task DeleteHeroAsync()
    {
        BrandSettings? brand = await _brandRepository.GetAsync();
        if (brand?.HeaderImageUrl != null)
        {
            // Clear the persisted reference first so a missing/invalid physical file
            // never blocks removal. Best-effort deletion of the file on disk.
            string url = brand.HeaderImageUrl;
            brand.HeaderImageUrl = null;
            await _brandRepository.SaveChangesAsync();
            TryDeleteFile(url);

            DescribeMedia(AuditActions.MediaDelete, HeroSlot, "Homepage header image", null,
                "Removed the homepage header image");
        }
    }

    public virtual async Task<string?> UploadLocationAsync(int id, Stream fileStream, string contentType)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null) return null;

        EnsureMediaDir();
        foreach (string old in Directory.GetFiles(_mediaDir, $"location-{id}.*"))
            System.IO.File.Delete(old);

        string filename = $"location-{id}.{GetExtension(contentType)}";
        await using (FileStream dest = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
            await fileStream.CopyToAsync(dest);

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        restaurant.ImageUrl = url;
        await _restaurantRepository.SaveChangesAsync();

        DescribeMedia(AuditActions.MediaUpload, LocationSlot(id), restaurant.Name, id,
            $"Uploaded a new photo for {restaurant.Name}");
        return url;
    }

    public virtual async Task<bool> DeleteLocationAsync(int id)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null) return false;
        if (restaurant.ImageUrl != null)
        {
            // Clear the persisted reference first so a missing/invalid physical file
            // never blocks removal. Best-effort deletion of the file on disk.
            string url = restaurant.ImageUrl;
            restaurant.ImageUrl = null;
            await _restaurantRepository.SaveChangesAsync();
            TryDeleteFile(url);

            DescribeMedia(AuditActions.MediaDelete, LocationSlot(id), restaurant.Name, id,
                $"Removed the photo for {restaurant.Name}");
        }
        return true;
    }

    public virtual async Task<string?> UploadMenuAsync(int id, Stream fileStream)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null) return null;

        EnsureMediaDir();
        // Only the instance-served menu file occupies the menu-<id>.* slot, so any
        // previous upload (regardless of extension) is cleared before writing the
        // new one. External links live in the same MenuUrl column; if the previous
        // value was a link rather than a served file, TryDeleteFile below is a no-op
        // (the path won't resolve under _mediaDir) and the link is simply replaced.
        foreach (string old in Directory.GetFiles(_mediaDir, $"menu-{id}.*"))
            System.IO.File.Delete(old);

        string filename = $"menu-{id}.pdf";
        await using (FileStream dest = System.IO.File.Create(Path.Combine(_mediaDir, filename)))
            await fileStream.CopyToAsync(dest);

        string url = $"/media/{filename}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        restaurant.MenuUrl = url;
        await _restaurantRepository.SaveChangesAsync();

        DescribeMedia(AuditActions.MediaUpload, MenuSlot(id), $"{restaurant.Name} menu", id,
            $"Uploaded a new menu for {restaurant.Name}");
        return url;
    }

    public virtual async Task<bool> DeleteMenuAsync(int id)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null) return false;
        if (restaurant.MenuUrl != null)
        {
            // Clear the persisted reference first so a missing/invalid physical file
            // never blocks removal. Best-effort deletion of the file on disk.
            string url = restaurant.MenuUrl;
            restaurant.MenuUrl = null;
            await _restaurantRepository.SaveChangesAsync();
            TryDeleteFile(url);

            DescribeMedia(AuditActions.MediaDelete, MenuSlot(id), $"{restaurant.Name} menu", id,
                $"Removed the menu for {restaurant.Name}");
        }
        return true;
    }

    /// <summary>The deterministic on-disk slots an upload writes into, as audit target ids.</summary>
    private const string HeroSlot = "hero";
    private static string LocationSlot(int restaurantId) => $"location-{restaurantId}";
    private static string MenuSlot(int restaurantId) => $"menu-{restaurantId}";

    private void DescribeMedia(string action, string slot, string label, int? restaurantId, string summary)
        => _audit.Describe(action, AuditTargets.Media, slot, label, restaurantId, summary);

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
