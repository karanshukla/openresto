using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Auth;

/// <inheritdoc cref="ICurrentUserService" />
internal sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

    private ClaimsPrincipal? Principal => _httpContextAccessor.HttpContext?.User;

    public int? UserId
    {
        get
        {
            // Depending on whether inbound claim-type mapping is in play, the "sub" claim
            // surfaces either under its raw name or remapped to NameIdentifier — read both
            // rather than betting on the handler's configuration.
            string? raw = Claim(ClaimTypes.NameIdentifier) ?? Claim(JwtRegisteredClaimNames.Sub);
            return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int id)
                ? id
                : null;
        }
    }

    public string? Email => Claim(ClaimTypes.Email) ?? Claim(JwtRegisteredClaimNames.Email);

    public string? Role => Claim(ClaimTypes.Role);

    public bool IsApiKeyAuthenticated => Principal?.IsApiKeyAuthenticated() ?? false;

    public bool HasScope(string resource, string access)
        => !IsApiKeyAuthenticated || (Principal?.HasScope(resource, access) ?? false);

    private string? Claim(string type) => Principal?.FindFirst(type)?.Value;
}
