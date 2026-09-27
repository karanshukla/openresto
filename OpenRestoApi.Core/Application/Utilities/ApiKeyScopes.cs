namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The allow-list of <c>{resource, access}</c> pairs an admin API key (issue #319) can be minted
/// with. Resources mirror the noun groups <see cref="AuditActions"/> already keys mutations by —
/// a key's surface is described in the same vocabulary the audit trail reads back — with three
/// additions that are not audit nouns: <see cref="Audit"/> (read access to the audit trail itself),
/// <see cref="Guests"/> (a visibility toggle on booking reads, not a resource of its own; its
/// redaction enforcement is a later phase, but the scope must exist now so a key can be minted
/// with it), and <see cref="Email"/> (whether outgoing mail is configured and delivering — never
/// the credentials it is configured with).
/// <para>
/// Deliberately excluded from the surface entirely: the SMTP credential surface
/// (<c>EmailSettingsController</c>), <c>notification</c>/<c>push</c>, and the auth self-service
/// endpoints. Those stay reachable by JWT/browser session only — see
/// <c>NoApiKeyAccessAttribute</c>. A key able to rewrite host, username and password would be a
/// mail-interception primitive living in a CI secret, which is why <see cref="Email"/> reaches
/// only configured-ness and delivery failures, and carries no write level at all.
/// </para>
/// </summary>
public static class ApiKeyScopes
{
    public const string Bookings = "bookings";
    public const string Locations = "locations";
    public const string Tables = "tables";
    public const string Brand = "brand";
    public const string Users = "users";
    public const string Audit = "audit";
    public const string Guests = "guests";
    public const string Email = "email";

    public const string Read = "read";
    public const string Write = "write";

    /// <summary>The resources a scope pair may name.</summary>
    public static readonly HashSet<string> Resources =
        new(StringComparer.Ordinal) { Bookings, Locations, Tables, Brand, Users, Audit, Guests, Email };

    /// <summary>The access levels a scope pair may name.</summary>
    public static readonly HashSet<string> AccessLevels =
        new(StringComparer.Ordinal) { Read, Write };

    /// <summary>
    /// Resources with no corresponding write surface: the audit trail is append-only with no
    /// admin write endpoint, guest-visibility is a read-time toggle rather than a mutable
    /// resource, and outgoing-mail configuration is deliberately never writable by a key.
    /// Minting <c>audit:write</c>, <c>guests:write</c> or <c>email:write</c> is rejected rather
    /// than silently accepted as a scope nothing will ever check.
    /// <seealso>ApiKeyScopesTests.IsValid_RejectsWriteOnAReadOnlyResource</seealso>
    /// <seealso>ApiKeyScopesTests.IsValid_RejectsEmailWrite</seealso>
    /// </summary>
    private static readonly HashSet<string> ReadOnlyResources =
        new(StringComparer.Ordinal) { Audit, Guests, Email };

    /// <summary>
    /// True for exactly the pairs a key may be minted with: a known resource, a known access
    /// level, and not a write on a read-only resource.
    /// <seealso>ApiKeyScopesTests.IsValid_AcceptsReadOnAReadOnlyResource</seealso>
    /// <seealso>ApiKeyScopesTests.IsValid_RejectsWriteOnAReadOnlyResource</seealso>
    /// <seealso>ApiKeyScopesTests.IsValid_RejectsAnUnknownResource</seealso>
    /// <seealso>ApiKeyScopesTests.IsValid_RejectsAnUnknownAccessLevel</seealso>
    /// </summary>
    public static bool IsValid(string? resource, string? access)
        => resource is not null
            && access is not null
            && Resources.Contains(resource)
            && AccessLevels.Contains(access)
            && !(access == Write && ReadOnlyResources.Contains(resource));
}
