namespace OpenRestoApi.Core.Domain;

/// <summary>
/// A long-lived credential for the headless CLI (issue #319), scoped to a subset of what its
/// owning <see cref="AdminCredential"/> can do. The raw key is never stored — see
/// <see cref="Core.Application.Utilities.ApiKeyCrypto"/> for the hash it is verified against.
/// </summary>
public class AdminApiKey
{
    public int Id { get; set; }

    /// <summary>
    /// The account this key acts as. Role and active status are always read live off this row at
    /// auth time, never baked into the key at mint time, so deactivating or demoting the user
    /// takes effect on the key's very next use.
    /// </summary>
    public int UserId { get; set; }
    public AdminCredential? User { get; set; }

    /// <summary>
    /// What the owner named it — the one human-readable thing an audit entry can show for a
    /// request made by a key, since the secret and its hash never can be.
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>SHA-256 hex digest of the full raw key. See <c>ApiKeyCrypto</c> for why the whole
    /// string is hashed rather than just its secret segment.</summary>
    public string KeyHash { get; set; } = null!;

    /// <summary>
    /// A short, non-secret prefix of the raw key, kept for display in the key list so an owner
    /// can tell two keys apart without the secret ever being retrievable again.
    /// </summary>
    public string Prefix { get; set; } = null!;

    /// <summary>JSON array of <c>{resource, access}</c> pairs — see
    /// <see cref="Core.Application.Utilities.ApiKeyScopes"/> for the allow-list they are drawn from.</summary>
    public string ScopesJson { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Soft revoke, same reasoning as <see cref="AdminCredential.IsActive"/>: the row stays so
    /// audit entries the key produced keep resolving to a name instead of an orphaned id.
    /// </summary>
    public DateTime? RevokedAt { get; set; }
}
