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
    public DateTime? ExpiresAt { get; set; }
}
