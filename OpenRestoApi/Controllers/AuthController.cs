using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public AuthController(IConfiguration config, AppDbContext db)
    {
        _config = config;
        _db = db;
    }

    // ── Login ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Authenticate with admin credentials. Returns a JWT valid for 30 days.
    /// On first call, bootstraps credentials from appsettings (Admin:Email / Admin:Password).
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var cred = await GetOrCreateCredentialAsync();

        if (!string.Equals(req.Email, cred.Email, StringComparison.OrdinalIgnoreCase))
            return Unauthorized(new { message = "Invalid email or password." });

        if (!VerifyPassword(req.Password, cred.PasswordHash, cred.PasswordSalt))
            return Unauthorized(new { message = "Invalid email or password." });

        return Ok(new { token = GenerateJwt(cred.Email) });
    }

    /// <summary>Quick check — returns 200 if the caller's JWT is valid.</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        return Ok(new { email });
    }

    // ── Password management ──────────────────────────────────────────────────

    /// <summary>Change password while logged in (requires current password).</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var cred = await GetOrCreateCredentialAsync();

        if (!VerifyPassword(req.CurrentPassword, cred.PasswordHash, cred.PasswordSalt))
            return Unauthorized(new { message = "Current password is incorrect." });

        if (req.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password changed successfully." });
    }

    // ── PVQ endpoints ────────────────────────────────────────────────────────

    /// <summary>Returns the admin's security question (used on the forgot-password screen).</summary>
    [HttpGet("pvq")]
    public async Task<IActionResult> GetPvqStatus()
    {
        var cred = await _db.AdminCredentials.FirstOrDefaultAsync();
        return Ok(new PvqStatusDto
        {
            IsConfigured = cred?.PvqQuestion != null,
            Question = cred?.PvqQuestion,
        });
    }

    /// <summary>Set or replace the security question + answer. Requires active session.</summary>
    [HttpPost("pvq/setup")]
    [Authorize]
    public async Task<IActionResult> SetupPvq([FromBody] SetupPvqRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
            return BadRequest(new { message = "Question and answer are required." });

        var cred = await GetOrCreateCredentialAsync();
        (cred.PvqAnswerHash, cred.PvqAnswerSalt) = HashPassword(NormaliseAnswer(req.Answer));
        cred.PvqQuestion = req.Question.Trim();
        await _db.SaveChangesAsync();
        return Ok(new { message = "Security question configured." });
    }

    /// <summary>
    /// Verify the PVQ answer. On success returns a short-lived reset token (15 min).
    /// </summary>
    [HttpPost("pvq/verify")]
    public async Task<IActionResult> VerifyPvq([FromBody] VerifyPvqRequest req)
    {
        var cred = await _db.AdminCredentials
            .FirstOrDefaultAsync(c => c.Email.ToLower() == req.Email.ToLower());

        if (cred?.PvqAnswerHash == null || cred.PvqAnswerSalt == null)
            return BadRequest(new { message = "Security question not configured for this account." });

        if (!VerifyPassword(NormaliseAnswer(req.Answer), cred.PvqAnswerHash, cred.PvqAnswerSalt))
            return Unauthorized(new { message = "Incorrect answer." });

        var token = Guid.NewGuid().ToString("N");
        cred.ResetToken = token;
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _db.SaveChangesAsync();

        return Ok(new { resetToken = token });
    }

    /// <summary>Use a reset token (from PVQ verify) to set a new password.</summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var cred = await _db.AdminCredentials
            .FirstOrDefaultAsync(c => c.ResetToken == req.ResetToken);

        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
            return BadRequest(new { message = "Invalid or expired reset token." });

        if (req.NewPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(req.NewPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully." });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the AdminCredential row, creating it from appsettings on first use.
    /// </summary>
    private async Task<AdminCredential> GetOrCreateCredentialAsync()
    {
        var cred = await _db.AdminCredentials.FirstOrDefaultAsync();
        if (cred != null) return cred;

        var email    = _config["Admin:Email"]    ?? "admin@openresto.com";
        var password = _config["Admin:Password"] ?? "admin";

        var (hash, salt) = HashPassword(password);
        cred = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt };
        _db.AdminCredentials.Add(cred);
        await _db.SaveChangesAsync();
        return cred;
    }

    private string GenerateJwt(string email)
    {
        var keyBytes    = Encoding.UTF8.GetBytes(_config["Jwt:Key"]!);
        var credentials = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:            _config["Jwt:Issuer"],
            audience:          _config["Jwt:Audience"],
            claims:            [new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Role, "Admin")],
            expires:           DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static (string hash, string salt) HashPassword(string password)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var hash      = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, 100_000, HashAlgorithmName.SHA256, 32);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(saltBytes));
    }

    private static bool VerifyPassword(string password, string storedHash, string storedSalt)
    {
        var saltBytes    = Convert.FromBase64String(storedSalt);
        var computed     = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(computed, Convert.FromBase64String(storedHash));
    }

    /// <summary>Normalise PVQ answers: lowercase and trim for case-insensitive comparison.</summary>
    private static string NormaliseAnswer(string answer) => answer.Trim().ToLowerInvariant();
}
