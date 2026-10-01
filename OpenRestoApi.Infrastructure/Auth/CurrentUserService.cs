using System.Globalization;
using System.Security.Claims;
using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Auth;

/// <inheritdoc cref="ICurrentUserService" />
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[ExternalAccessAllowed]
internal sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

    private ClaimsPrincipal? Principal => _httpContextAccessor.HttpContext?.User;

    public int? UserId => Principal?.UserId();

    public string? Email => Principal?.Email();

    public string? Role => Claim(ClaimTypes.Role);

    public bool IsApiKeyAuthenticated => Principal?.IsApiKeyAuthenticated() ?? false;

    public int? KeyId
    {
        get
        {
            string? raw = Claim(ApiKeyClaimTypes.KeyId);
            return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int id)
                ? id
                : null;
        }
    }

    public bool HasScope(string resource, string access)
        => !IsApiKeyAuthenticated || (Principal?.HasScope(resource, access) ?? false);

    private string? Claim(string type) => Principal?.FindFirst(type)?.Value;
}
