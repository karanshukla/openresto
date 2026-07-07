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

    public string Generate(string email)
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
            claims: [new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Role, "Admin")],
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
