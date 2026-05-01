using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/auth")]
[EnableRateLimiting("auth")]
public class AuthController(IConfiguration config, AppDbContext db) : ControllerBase
{
    private readonly IConfiguration _config = config;
    private readonly AppDbContext _db = db;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();

        if (!string.Equals(req.Email, cred.Email, StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!VerifyPassword(req.Password, cred.PasswordHash, cred.PasswordSalt))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        string jwt = GenerateJwt(cred.Email);
        SetAuthCookie(jwt);
        return Ok(new { message = "Login successful." });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        bool isProduction = !string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

        Response.Cookies.Delete("openresto_auth", new CookieOptions
        {
            Path = "/",
            Secure = isProduction,
            SameSite = isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
        });
        return Ok(new { message = "Logged out." });
    }

    [HttpGet("me")]
    [Authorize]
    [EnableRateLimiting("public")]
    public IActionResult Me()
    {
        string? email = User.FindFirst(ClaimTypes.Email)?.Value;
        return Ok(new { email });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();

        if (!VerifyPassword(req.CurrentPassword, cred.PasswordHash, cred.PasswordSalt))
        {
            return Unauthorized(new { message = "Current password is incorrect." });
        }

        if (req.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "New password must be at least 6 characters." });
        }

        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password changed successfully." });
    }

    [HttpGet("pvq")]
    public async Task<IActionResult> GetPvqStatus()
    {
        AdminCredential? cred = await _db.AdminCredentials.FirstOrDefaultAsync();
        return Ok(new PvqStatusDto
        {
            IsConfigured = cred?.PvqQuestion != null,
            Question = cred?.PvqQuestion,
        });
    }

    [HttpPost("pvq/setup")]
    [Authorize]
    public async Task<IActionResult> SetupPvq([FromBody] SetupPvqRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
        {
            return BadRequest(new { message = "Question and answer are required." });
        }

        AdminCredential cred = await GetOrCreateCredentialAsync();
        (cred.PvqAnswerHash, cred.PvqAnswerSalt) = HashPassword(NormaliseAnswer(req.Answer));
        cred.PvqQuestion = req.Question.Trim();
        await _db.SaveChangesAsync();
        return Ok(new { message = "Security question configured." });
    }

    [HttpPost("pvq/verify")]
    public async Task<IActionResult> VerifyPvq([FromBody] VerifyPvqRequest req)
    {
        AdminCredential? cred = (await _db.AdminCredentials.ToListAsync())
            .FirstOrDefault(c => string.Equals(c.Email, req.Email, StringComparison.OrdinalIgnoreCase));

        if (cred?.PvqAnswerHash == null || cred.PvqAnswerSalt == null)
        {
            return BadRequest(new { message = "Security question not configured for this account." });
        }

        if (!VerifyPassword(NormaliseAnswer(req.Answer), cred.PvqAnswerHash, cred.PvqAnswerSalt))
        {
            return Unauthorized(new { message = "Incorrect answer." });
        }

        string token = Guid.NewGuid().ToString("N");
        cred.ResetToken = token;
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _db.SaveChangesAsync();

        return Ok(new { resetToken = token });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        AdminCredential? cred = await _db.AdminCredentials
            .FirstOrDefaultAsync(c => c.ResetToken == req.ResetToken);

        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Invalid or expired reset token." });
        }

        if (req.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Password must be at least 6 characters." });
        }

        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(req.NewPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully." });
    }

    private async Task<AdminCredential> GetOrCreateCredentialAsync()
    {
        AdminCredential? cred = await _db.AdminCredentials.FirstOrDefaultAsync();
        if (cred != null)
        {
            return cred;
        }

        string email = _config["Admin:Email"] ?? "admin@openresto.com";
        string password = _config["Admin:Password"] ?? "admin";

        (string? hash, string? salt) = HashPassword(password);
        cred = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt };
        _db.AdminCredentials.Add(cred);
        await _db.SaveChangesAsync();
        return cred;
    }

    private string GenerateJwt(string email)
    {
        byte[] keyBytes = Encoding.UTF8.GetBytes(_config["Jwt:Key"]!);
        var credentials = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: [new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Role, "Admin")],
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static (string hash, string salt) HashPassword(string password)
    {
        byte[] saltBytes = RandomNumberGenerator.GetBytes(16);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, 100_000, HashAlgorithmName.SHA256, 32);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(saltBytes));
    }

    private static bool VerifyPassword(string password, string storedHash, string storedSalt)
    {
        byte[] saltBytes = Convert.FromBase64String(storedSalt);
        byte[] computed = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(computed, Convert.FromBase64String(storedHash));
    }


    private static string NormaliseAnswer(string answer) => answer.Trim().ToLowerInvariant();

    private void SetAuthCookie(string jwt)
    {
        bool isProduction = !string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

        Response.Cookies.Append("openresto_auth", jwt, new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction,
            SameSite = isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(30),
        });
    }
}
