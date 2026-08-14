using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of admin user accounts (<see cref="AdminCredential"/>): login email + password
/// hash + PVQ reset question + role. All email lookups are persisted case-insensitively via
/// SQLite <c>lower()</c>; pass the raw email and the repo normalises it.
/// </summary>
public interface IAdminCredentialRepository
{
    /// <summary>
    /// The first credential row, or null if none exists yet. Only meaningful for
    /// "has this instance been bootstrapped?" checks — never for identifying the caller,
    /// which must go through <see cref="GetByIdAsync"/> with the JWT's user id.
    /// </summary>
    Task<AdminCredential?> GetAsync();

    /// <summary>The credential with the given id, or null.</summary>
    Task<AdminCredential?> GetByIdAsync(int id);

    /// <summary>The credential matching the given email (case-insensitive), or null.</summary>
    Task<AdminCredential?> GetByEmailAsync(string email);

    /// <summary>The credential matching the given password-reset token, or null.</summary>
    Task<AdminCredential?> GetByResetTokenAsync(string resetToken);

    /// <summary>All credentials, oldest first.</summary>
    Task<List<AdminCredential>> GetAllAsync();

    /// <summary>
    /// Count of active users holding <paramref name="role"/>. Backs the last-Owner guard, which
    /// must not be satisfiable by a deactivated row.
    /// </summary>
    Task<int> CountActiveByRoleAsync(string role);

    /// <summary>Adds and saves a new credential, returning the persisted entity.</summary>
    Task<AdminCredential> AddAsync(AdminCredential credential);

    /// <summary>Flushes pending changes (e.g. mutated hash/token fields on a tracked entity).</summary>
    Task SaveChangesAsync();
}
