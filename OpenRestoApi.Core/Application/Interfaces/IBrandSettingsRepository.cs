using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of the singleton <see cref="BrandSettings"/> row (app name, colors, favicon, hero image, etc.).
/// </summary>
public interface IBrandSettingsRepository
{
    /// <summary>The single brand row, or null if none exists yet.</summary>
    Task<BrandSettings?> GetAsync();

    /// <summary>Tracks a new brand row for insertion and saves, returning the persisted entity.</summary>
    Task<BrandSettings> AddAsync(BrandSettings brand);

    /// <summary>Flushes pending changes on a tracked brand entity.</summary>
    Task SaveChangesAsync();
}
