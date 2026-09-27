using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Persistence of <see cref="AdminApiKey"/> rows (issue #319 headless-CLI credentials).</summary>
public interface IAdminApiKeyRepository
{
    /// <summary>The key with the given id, or null. Used both by the management service (which
    /// then checks ownership) and by the authentication handler (which narrows straight to this
    /// row from the id segment of the raw key before hashing anything).</summary>
    Task<AdminApiKey?> GetByIdAsync(int id);

    /// <summary>All keys owned by the given user, newest first.</summary>
    Task<List<AdminApiKey>> GetByUserIdAsync(int userId);

    /// <summary>Adds and saves a new key, returning the persisted entity (with its id assigned).</summary>
    Task<AdminApiKey> AddAsync(AdminApiKey key);

    /// <summary>Flushes pending changes (e.g. the hash/prefix set after the id is known, or a
    /// revoke/last-used update on a tracked entity).</summary>
    Task SaveChangesAsync();
}
