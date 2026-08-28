namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// The authenticated caller, read off the request's JWT claims. Lets services act on
/// "whoever is signed in" without taking a dependency on <c>HttpContext</c>, and keeps
/// self-service (change password/email/PVQ) targeting one specific user rather than a
/// global record.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// The caller's user id, or null when unauthenticated — or when the token predates
    /// multi-user support and carries no <c>sub</c> claim, in which case
    /// <see cref="Email"/> is the only usable identifier.
    /// </summary>
    int? UserId { get; }

    /// <summary>The caller's email claim, or null when unauthenticated.</summary>
    string? Email { get; }

    /// <summary>The caller's role claim, or null when unauthenticated.</summary>
    string? Role { get; }

    /// <summary>
    /// True when the caller authenticated via an admin API key (issue #319) rather than a
    /// JWT/browser session. A key carries scope claims narrowing what it can do; a JWT/browser
    /// session carries none and is never scope-restricted.
    /// </summary>
    bool IsApiKeyAuthenticated { get; }

    /// <summary>
    /// The <c>AdminApiKey.Id</c> that authenticated this request, or null for a JWT/browser
    /// session (or a malformed/legacy key claim). Only meaningful alongside
    /// <see cref="IsApiKeyAuthenticated"/> — used by <c>ApiKeyService.GetSelfAsync</c> to look the
    /// calling key back up for introspection.
    /// </summary>
    int? KeyId { get; }

    /// <summary>
    /// True when the caller holds the given <c>{resource}:{access}</c> scope (write also
    /// satisfies a read requirement — see <c>ApiKeyClaimTypes.HasScope</c>). Always true for a
    /// JWT/browser session, which carries no scopes and is unrestricted by design; only ever
    /// false for a key that was minted without the scope.
    /// </summary>
    bool HasScope(string resource, string access);
}
