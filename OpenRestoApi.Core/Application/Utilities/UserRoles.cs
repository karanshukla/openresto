namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The single place admin role values are defined. Adding a role (e.g. <c>Host</c>) means
/// adding one constant here plus one entry in <see cref="Assignable"/> — never a literal
/// sprinkled across controllers or services. Gating is done through the named policies in
/// <see cref="AuthPolicies"/>, so a new role does not require touching any <c>[Authorize]</c>
/// attribute.
/// </summary>
public static class UserRoles
{
    /// <summary>Full access, including user management.</summary>
    public const string Owner = "Owner";

    /// <summary>Full access to bookings/locations/brand, but cannot manage users.</summary>
    public const string Manager = "Manager";

    /// <summary>
    /// The role claim minted before multi-user support existed. No user row ever carries it —
    /// it only appears in 30-day JWTs issued by an older build. Both policies honour it so an
    /// in-flight session survives the upgrade instead of being silently logged out; it can be
    /// dropped once every pre-upgrade token has expired.
    /// </summary>
    public const string LegacyAdmin = "Admin";

    /// <summary>Roles that may be stored on a user row / assigned through the API.</summary>
    public static readonly HashSet<string> Assignable =
        new(StringComparer.OrdinalIgnoreCase) { Owner, Manager };

    /// <summary>
    /// Returns the canonically-cased role when <paramref name="role"/> is assignable, else null.
    /// Callers turn the null into a <c>ValidationException</c> with their own message.
    /// </summary>
    public static string? Normalise(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return null;
        string trimmed = role.Trim();
        return Assignable.Contains(trimmed)
            ? Assignable.First(r => string.Equals(r, trimmed, StringComparison.OrdinalIgnoreCase))
            : null;
    }
}
