using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.TestInfrastructure;

/// <summary>
/// Stands in for the claims on the request. <see cref="ForLegacyToken"/> models the tokens
/// minted before multi-user support — email claim only, no user id — which services must still
/// resolve.
/// </summary>
internal sealed class FakeCurrentUser : ICurrentUserService
{
    public int? UserId { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
    public bool IsApiKeyAuthenticated { get; set; }

    /// <summary>Scopes held when <see cref="IsApiKeyAuthenticated"/> is true. Ignored (every
    /// scope is satisfied) for a JWT/browser session, matching <c>CurrentUserService</c>.</summary>
    public HashSet<string> Scopes { get; set; } = [];

    public bool HasScope(string resource, string access)
        => !IsApiKeyAuthenticated || Scopes.Contains($"{resource}:{access}");

    public static FakeCurrentUser For(AdminCredential user) => new()
    {
        UserId = user.Id,
        Email = user.Email,
        Role = user.Role,
    };

    public static FakeCurrentUser ForLegacyToken(string email) => new()
    {
        Email = email,
        Role = UserRoles.LegacyAdmin,
    };

    public static FakeCurrentUser Anonymous() => new();

    /// <summary>An API-key-authenticated caller holding exactly the given <c>{resource}:{access}</c>
    /// scopes — write is not expanded to also satisfy read here, so tests can pin the exact grant
    /// they mean to check.</summary>
    public static FakeCurrentUser ApiKey(params (string Resource, string Access)[] scopes) => new()
    {
        IsApiKeyAuthenticated = true,
        Scopes = scopes.Select(s => $"{s.Resource}:{s.Access}").ToHashSet(),
    };
}
