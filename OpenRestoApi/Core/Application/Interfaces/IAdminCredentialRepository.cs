using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of the singleton <see cref="AdminCredential"/> row (login email + password hash +
/// PVQ reset question/answer). All email lookups are persisted case-insensitively via SQLite
/// <c>lower()</c>; pass the raw email and the repo normalises it.
/// </summary>
public interface IAdminCredentialRepository
{
    /// <summary>The single admin credential row, or null if none exists yet.</summary>
    Task<AdminCredential?> GetAsync();

    /// <summary>The credential matching the given email (case-insensitive), or null.</summary>
    Task<AdminCredential?> GetByEmailAsync(string email);

    /// <summary>The credential matching the given password-reset token, or null.</summary>
    Task<AdminCredential?> GetByResetTokenAsync(string resetToken);

    /// <summary>Adds and saves a new credential, returning the persisted entity.</summary>
    Task<AdminCredential> AddAsync(AdminCredential credential);

    /// <summary>Flushes pending changes (e.g. mutated hash/token fields on a tracked entity).</summary>
    Task SaveChangesAsync();
}
