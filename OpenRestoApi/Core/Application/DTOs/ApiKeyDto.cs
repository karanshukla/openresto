using System.Text.Json;

namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// One <c>{resource, access}</c> pair — see <see cref="Core.Application.Utilities.ApiKeyScopes"/>
/// for the allow-list. Doubles as the shape persisted in <c>AdminApiKey.ScopesJson</c>, so the
/// codec lives here rather than in the service: the read side (the authentication handler) and
/// the write side (the management service) both need it and neither owns the other.
/// </summary>
public class ApiKeyScopeDto
{
    public string Resource { get; set; } = null!;
    public string Access { get; set; } = null!;

    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static string Serialize(IEnumerable<ApiKeyScopeDto> scopes)
        => JsonSerializer.Serialize(scopes, JsonOptions);

    public static List<ApiKeyScopeDto> ParseList(string json)
        => JsonSerializer.Deserialize<List<ApiKeyScopeDto>>(json, JsonOptions) ?? [];
}

/// <summary>An API key as surfaced to the admin UI/CLI — never the hash, never the secret.</summary>
public class ApiKeyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Prefix { get; set; } = null!;
    public List<ApiKeyScopeDto> Scopes { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

/// <summary>
/// The one response that ever carries the raw secret — returned exactly once, at creation, and
/// never retrievable again afterwards.
/// </summary>
public class ApiKeyCreatedDto : ApiKeyDto
{
    public string Secret { get; set; } = null!;
}

public class CreateApiKeyRequest
{
    public string Name { get; set; } = null!;
    public List<ApiKeyScopeDto> Scopes { get; set; } = [];

    /// <summary>An explicit expiry. Omit this to get the safe default (see
    /// <see cref="NeverExpires"/>); when set, it must be in the future and
    /// <see cref="NeverExpires"/> must not also be true.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Opts a key out of the default one-year expiry entirely. Only meaningful when
    /// <see cref="ExpiresAt"/> is omitted — setting both is rejected rather than silently
    /// preferring one, since a client sending both almost certainly means only one of them.</summary>
    public bool NeverExpires { get; set; }
}

/// <summary>
/// A key's view of itself (<c>GET api/admin/api-keys/self</c>, issue #319 Phase 2) — the same
/// metadata as <see cref="ApiKeyDto"/> plus who it belongs to, so a CLI's <c>auth whoami</c> can
/// confirm both the key and the account it acts as without a separate call.
/// </summary>
public class ApiKeySelfDto : ApiKeyDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = null!;
    public string Role { get; set; } = null!;
}

public enum ApiKeySelfStatus
{
    /// <summary>The caller is not authenticated via an API key — a JWT/browser session has no
    /// key to introspect.</summary>
    NotAnApiKeySession,

    /// <summary>The key claimed on the principal no longer exists (should not happen in practice
    /// since revoking/deleting never removes the row mid-request, but handled defensively).</summary>
    KeyNotFound,
    Ok,
}

public class ApiKeySelfResult
{
    public ApiKeySelfStatus Status { get; init; }
    public ApiKeySelfDto? Key { get; init; }

    public static readonly ApiKeySelfResult NotAnApiKeySession = new() { Status = ApiKeySelfStatus.NotAnApiKeySession };
    public static readonly ApiKeySelfResult KeyNotFound = new() { Status = ApiKeySelfStatus.KeyNotFound };
    public static ApiKeySelfResult Found(ApiKeySelfDto key) => new() { Status = ApiKeySelfStatus.Ok, Key = key };
}
