using System.Security.Claims;
using OpenRestoApi.Core.Application.Utilities;

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

    /// <summary>
    /// True when the principal carries the exact <c>{resource}:{access}</c> scope claim, or — for
    /// a <see cref="ApiKeyScopes.Read"/> requirement only — the corresponding
    /// <see cref="ApiKeyScopes.Write"/> claim instead: a key trusted to mutate a resource is
    /// trusted to view it, so minting both to read what you can already write would be a scope
    /// that does nothing. The reverse never holds — a read grant does not satisfy a write
    /// requirement.
    /// <seealso>ApiKeyClaimTypesTests.HasScope_WriteScopeSatisfiesAReadRequirement</seealso>
    /// <seealso>ApiKeyClaimTypesTests.HasScope_ReadScopeDoesNotSatisfyAWriteRequirement</seealso>
    /// </summary>
    public static bool HasScope(this ClaimsPrincipal user, string resource, string access)
    {
        HashSet<string> granted = user.FindAll(Scope).Select(c => c.Value).ToHashSet(StringComparer.Ordinal);
        return granted.Contains($"{resource}:{access}")
            || (access == ApiKeyScopes.Read && granted.Contains($"{resource}:{ApiKeyScopes.Write}"));
    }
}
