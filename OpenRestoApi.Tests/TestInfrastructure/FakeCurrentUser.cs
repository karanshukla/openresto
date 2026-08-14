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
}
