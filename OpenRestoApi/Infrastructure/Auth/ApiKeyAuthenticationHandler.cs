using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
// Microsoft.AspNetCore.Authentication carries its own (deprecated) ISystemClock; alias ours so
// the two don't collide.
using ISystemClock = OpenRestoApi.Core.Application.Interfaces.ISystemClock;

namespace OpenRestoApi.Infrastructure.Auth;

/// <summary>
/// Authenticates a request bearing an <see cref="ApiKeyClaimTypes.HeaderName"/> header (issue
/// #319), minting the same shape of claims a JWT carries (<c>sub</c>, email, role) — resolved
/// fresh off the user row on every request, never baked into the key at mint time, so
/// deactivating or demoting the underlying account takes effect on the key's very next use. A
/// policy scheme registered in front of both this and JWT Bearer
/// (<c>ServiceCollectionExtensions.AddCustomAuthentication</c>) forwards here whenever the header
/// is present, so every existing <c>[Authorize(Policy = ...)]</c> accepts either with zero
/// controller changes.
/// </summary>
public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory loggerFactory,
    UrlEncoder encoder,
    IAdminApiKeyRepository apiKeyRepository,
    IAdminCredentialRepository credentialRepository,
    ISystemClock clock)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, loggerFactory, encoder)
{
    /// <summary>
    /// <c>LastUsedAt</c> is only re-persisted once it has moved by at least this much, so a key
    /// polled every few seconds by a CLI loop doesn't turn every single request into a write on
    /// the hot path.
    /// </summary>
    private static readonly TimeSpan LastUsedGranularity = TimeSpan.FromMinutes(1);

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(ApiKeyClaimTypes.HeaderName, out var headerValues))
        {
            return AuthenticateResult.NoResult();
        }

        string? rawKey = headerValues.Count > 0 ? headerValues[0] : null;
        if (string.IsNullOrEmpty(rawKey) || !ApiKeyCrypto.TryParseId(rawKey, out int id))
        {
            return AuthenticateResult.Fail("Malformed API key.");
        }

        AdminApiKey? key = await apiKeyRepository.GetByIdAsync(id);
        if (key is null || !ApiKeyCrypto.Verify(rawKey, key.KeyHash))
        {
            return AuthenticateResult.Fail("Invalid API key.");
        }

        DateTime now = clock.UtcNow;
        if (key.RevokedAt is not null)
        {
            return AuthenticateResult.Fail("This API key has been revoked.");
        }
        if (key.ExpiresAt is not null && key.ExpiresAt <= now)
        {
            return AuthenticateResult.Fail("This API key has expired.");
        }

        AdminCredential? user = await credentialRepository.GetByIdAsync(key.UserId);
        if (user is null || !user.IsActive)
        {
            return AuthenticateResult.Fail("The account for this API key is no longer active.");
        }

        await TouchLastUsedAsync(key, now);

        var ticket = new AuthenticationTicket(BuildPrincipal(key, user), Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }

    private async Task TouchLastUsedAsync(AdminApiKey key, DateTime now)
    {
        if (key.LastUsedAt is not null && now - key.LastUsedAt.Value < LastUsedGranularity)
        {
            return;
        }

        key.LastUsedAt = now;
        await apiKeyRepository.SaveChangesAsync();
    }

    private static ClaimsPrincipal BuildPrincipal(AdminApiKey key, AdminCredential user)
    {
        List<Claim> claims =
        [
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString(CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ApiKeyClaimTypes.KeyId, key.Id.ToString(CultureInfo.InvariantCulture)),
            new Claim(ApiKeyClaimTypes.KeyName, key.Name),
        ];
        claims.AddRange(ApiKeyScopeDto.ParseList(key.ScopesJson)
            .Select(s => new Claim(ApiKeyClaimTypes.Scope, $"{s.Resource}:{s.Access}")));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, ApiKeyClaimTypes.Scheme));
    }
}
