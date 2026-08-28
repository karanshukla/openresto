using System.Security.Claims;

namespace OpenRestoApi.Infrastructure.Auth;

/// <summary>
/// The authentication-scheme name and claim types <see cref="ApiKeyAuthenticationHandler"/> mints
/// on success, plus the predicates <c>RequiresScopeAttribute</c>/<c>NoApiKeyAccessAttribute</c>
/// and the audit middleware read them back through. Kept together because all four consumers need
/// the exact same strings.
/// </summary>
public static class ApiKeyClaimTypes
{
    /// <summary>The authentication scheme name, and the <see cref="ClaimsIdentity.AuthenticationType"/>
    /// stamped on a principal authenticated this way — checking the latter is how the rest of the
    /// pipeline tells an API-key request apart from a JWT/cookie session without a dedicated claim.</summary>
    public const string Scheme = "ApiKey";

    /// <summary>The header a key is presented in. Deliberately not <c>Authorization</c>, so the
    /// two schemes never sniff a shared header.</summary>
    public const string HeaderName = "X-API-Key";

    /// <summary>The <c>AdminApiKey.Id</c> that authenticated this request.</summary>
    public const string KeyId = "orst:key_id";

    /// <summary>The key's <c>Name</c> — what makes an audit entry attributable to a specific key.</summary>
    public const string KeyName = "orst:key_name";

    /// <summary>One claim per granted <c>{resource}:{access}</c> pair.</summary>
    public const string Scope = "orst:scope";

    public static bool IsApiKeyAuthenticated(this ClaimsPrincipal user)
        => string.Equals(user.Identity?.AuthenticationType, Scheme, StringComparison.Ordinal);

    public static bool HasScope(this ClaimsPrincipal user, string resource, string access)
        => user.FindAll(Scope).Any(c => c.Value == $"{resource}:{access}");
}
