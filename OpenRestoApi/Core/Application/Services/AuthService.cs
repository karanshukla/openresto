using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public enum PvqVerifyStatus { NotConfigured, WrongAnswer, Success }
public record PvqVerifyOutcome(PvqVerifyStatus Status, string? ResetToken = null);

public class AuthService(IAdminCredentialRepository credentialRepository, IConfiguration config)
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IConfiguration _config = config;

    public virtual async Task<string?> LoginAsync(string email, string password)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!string.Equals(email, cred.Email, StringComparison.OrdinalIgnoreCase))
            return null;
        if (!VerifyPassword(password, cred.PasswordHash, cred.PasswordSalt))
            return null;
        return GenerateJwt(cred.Email);
    }

    public virtual async Task<bool> ChangePasswordAsync(string currentPassword, string newPassword)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!VerifyPassword(currentPassword, cred.PasswordHash, cred.PasswordSalt))
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(newPassword);
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<string?> ChangeEmailAsync(string currentPassword, string newEmail)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!VerifyPassword(currentPassword, cred.PasswordHash, cred.PasswordSalt))
            return null;
        string normalizedEmail = newEmail.Trim().ToLowerInvariant();
        if (string.Equals(normalizedEmail, cred.Email, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("New email must be different from the current email.");
        cred.Email = normalizedEmail;
        await _credentialRepository.SaveChangesAsync();
        return GenerateJwt(cred.Email);
    }

    public virtual async Task<PvqStatusDto> GetPvqStatusAsync()
    {
        AdminCredential? cred = await _credentialRepository.GetAsync();
        return new PvqStatusDto
        {
            IsConfigured = cred?.PvqQuestion != null,
            Question = cred?.PvqQuestion,
        };
    }

    public virtual async Task SetupPvqAsync(string question, string answer)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        (cred.PvqAnswerHash, cred.PvqAnswerSalt) = HashPassword(NormaliseAnswer(answer));
        cred.PvqQuestion = question.Trim();
        await _credentialRepository.SaveChangesAsync();
    }

    public virtual async Task<PvqVerifyOutcome> VerifyPvqAsync(string email, string answer)
    {
        AdminCredential? cred = await _credentialRepository.GetByEmailAsync(email);

        if (cred?.PvqAnswerHash == null || cred.PvqAnswerSalt == null)
            return new PvqVerifyOutcome(PvqVerifyStatus.NotConfigured);

        if (!VerifyPassword(NormaliseAnswer(answer), cred.PvqAnswerHash, cred.PvqAnswerSalt))
            return new PvqVerifyOutcome(PvqVerifyStatus.WrongAnswer);

        string token = Guid.NewGuid().ToString("N");
        cred.ResetToken = token;
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _credentialRepository.SaveChangesAsync();
        return new PvqVerifyOutcome(PvqVerifyStatus.Success, token);
    }

    public virtual async Task<bool> ResetPasswordAsync(string resetToken, string newPassword)
    {
        AdminCredential? cred = await _credentialRepository.GetByResetTokenAsync(resetToken);
        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = HashPassword(newPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    private async Task<AdminCredential> GetOrCreateCredentialAsync()
    {
        AdminCredential? cred = await _credentialRepository.GetAsync();
        if (cred != null) return cred;

        string? configEmail = _config["Admin:Email"];
        string email = !string.IsNullOrWhiteSpace(configEmail)
            ? configEmail
            : Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@openresto.com";

        string? configPassword = _config["Admin:Password"];
        string? password = !string.IsNullOrWhiteSpace(configPassword)
            ? configPassword
            : Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

        if (string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "Admin:Password must be configured before first use. Set it via ADMIN_PASSWORD env var.");

        (string? hash, string? salt) = HashPassword(password);
        cred = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt };
        await _credentialRepository.AddAsync(cred);
        return cred;
    }

    private string GenerateJwt(string email)
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
}
