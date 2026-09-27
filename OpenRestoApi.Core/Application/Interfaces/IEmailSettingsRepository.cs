using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Persistence of the singleton <see cref="EmailSettings"/> row (SMTP config).</summary>
public interface IEmailSettingsRepository
{
    /// <summary>The single settings row, or null if none exists yet.</summary>
    Task<EmailSettings?> GetAsync();

    /// <summary>Tracks a new settings row for insertion and saves, returning the persisted entity.</summary>
    Task<EmailSettings> AddAsync(EmailSettings settings);

    /// <summary>Flushes pending changes on a tracked settings entity.</summary>
    Task SaveChangesAsync();
}
