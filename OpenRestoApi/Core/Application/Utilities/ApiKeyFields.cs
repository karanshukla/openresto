namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>Column caps for <c>AdminApiKey</c>, shared between <c>AppDbContext</c>'s configuration
/// and <c>ApiKeyService</c>'s validation so the two never drift apart.</summary>
public static class ApiKeyFields
{
    public const int MaxNameLength = 100;

    /// <summary>SHA-256 hex digest length (64 hex characters for 32 bytes).</summary>
    public const int KeyHashLength = 64;

    /// <summary>Matches <c>ApiKeyCrypto</c>'s display-prefix length.</summary>
    public const int MaxPrefixLength = 16;

    public const int MaxScopesJsonLength = 2000;
}
