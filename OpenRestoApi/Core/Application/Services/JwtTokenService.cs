using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IJwtTokenService" />
public sealed class JwtTokenService(IConfiguration config) : IJwtTokenService
{
    private readonly IConfiguration _config = config;

    public string Generate(int userId, string email, string role)
    {
        string? configKey = _config["Jwt:Key"];
        string jwtKey = string.IsNullOrWhiteSpace(configKey)
            ? Environment.GetEnvironmentVariable("JWT_KEY")!
            : configKey;
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            // The id is the stable identity: emails change, ids don't. Read back through
            // ICurrentUserService, which also tolerates the id-less tokens minted by older builds.
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString(CultureInfo.InvariantCulture)),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Role, role),
            ],
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
