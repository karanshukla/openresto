using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace OpenRestoApi.Infrastructure.Auth;

/// <summary>
/// Reads the account a principal names. Shared by <see cref="CurrentUserService"/>, which reads the
/// request's user, and the JWT handler's token-validated hook, which runs before there is one.
/// </summary>
public static class SessionClaims
{
    public static int? UserId(this ClaimsPrincipal user)
    {
        // Depending on whether inbound claim-type mapping is in play, the "sub" claim
        // surfaces either under its raw name or remapped to NameIdentifier — read both
        // rather than betting on the handler's configuration.
        string? raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int id)
            ? id
            : null;
    }

    public static string? Email(this ClaimsPrincipal user)
        => user.FindFirst(ClaimTypes.Email)?.Value ?? user.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
}
