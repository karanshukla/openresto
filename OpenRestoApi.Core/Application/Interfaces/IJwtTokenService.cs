namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Mints HS256 JWT bearer tokens carrying the user's id (<c>sub</c>), email, and role claim,
/// 30-day expiry. Key/issuer/audience resolved from <c>Jwt:*</c> config with a
/// <c>JWT_KEY</c> env-var fallback for the signing key.
/// </summary>
public interface IJwtTokenService
{
    /// <summary>Returns a signed JWT identifying the given user.</summary>
    string Generate(int userId, string email, string role);
}
