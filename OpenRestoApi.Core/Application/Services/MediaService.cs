using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class MediaService(
    IBrandSettingsRepository brandRepository,
    IRestaurantRepository restaurantRepository,
    IMediaStore media,
    IAuditScope? audit = null)
{
    /// <summary>
    /// Castle's generated proxy constructors drop default values, so a Moq class mock reaches only
    /// a constructor of exactly matching arity. This is that constructor.
    /// </summary>
    public MediaService(
        IBrandSettingsRepository brand,
        IRestaurantRepository restaurants,
        IMediaStore mediaStore)
        : this(brand, restaurants, mediaStore, null) { }

    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IMediaStore _media = media;

    public virtual async Task<string> UploadHeroAsync(Stream fileStream, string contentType)
    {
        string filename = await _media.ReplaceAsync(HeroSlot, GetExtension(contentType), fileStream);

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

        string filename = await _media.ReplaceAsync(LocationSlot(id), GetExtension(contentType), fileStream);

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

        // Only the instance-served menu file occupies the menu-<id> slot, so any
        // previous upload (regardless of extension) is cleared before writing the
        // new one. External links live in the same MenuUrl column; if the previous
        // value was a link rather than a served file, there is no file to clear and
        // the link is simply replaced.
        string filename = await _media.ReplaceAsync(MenuSlot(id), "pdf", fileStream);

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

    /// <summary>The <see cref="IMediaStore"/> slots an upload writes into, also used as audit target ids.</summary>
    private const string HeroSlot = "hero";
    private static string LocationSlot(int restaurantId) => $"location-{restaurantId}";
    private static string MenuSlot(int restaurantId) => $"menu-{restaurantId}";

    private void DescribeMedia(string action, string slot, string label, int? restaurantId, string summary)
        => _audit.Describe(action, AuditTargets.Media, slot, label, restaurantId, summary);

    /// <summary>
    /// Best-effort deletion of the file a stored <c>/media/…?v=…</c> URL points at, so that
    /// removing an image always succeeds even when the stored URL is invalid or the file has
    /// already been deleted.
    /// </summary>
    private void TryDeleteFile(string url)
        => _media.TryDelete(url.Contains('?') ? url[..url.IndexOf('?')] : url);

    private static string GetExtension(string contentType) => contentType switch
    {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "bin"
    };
}
