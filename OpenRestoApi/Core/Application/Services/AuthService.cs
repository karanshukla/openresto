using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Admin authentication orchestrator. Delegates password hashing to
/// <see cref="IPasswordService"/>, JWT minting to <see cref="IJwtTokenService"/>, and
/// PVQ/reset-question concerns to <see cref="ISecurityQuestionsService"/>.
/// </summary>
public class AuthService(
    IAdminCredentialRepository credentialRepository,
    IPasswordService passwordService,
    IJwtTokenService jwtTokenService,
    IConfiguration config) : IAuthService
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly IJwtTokenService _jwtTokenService = jwtTokenService;
    private readonly IConfiguration _config = config;

    public virtual async Task<string?> LoginAsync(string email, string password)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!string.Equals(email, cred.Email, StringComparison.OrdinalIgnoreCase))
            return null;
        if (!CredentialHelper.VerifyPassword(cred, password, _passwordService))
            return null;
        return _jwtTokenService.Generate(cred.Email);
    }

    public virtual async Task<bool> ChangePasswordAsync(string currentPassword, string newPassword)
    {
        if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 6)
            throw new ValidationException("Password must be at least 6 characters.");
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!CredentialHelper.VerifyPassword(cred, currentPassword, _passwordService))
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<string?> ChangeEmailAsync(string currentPassword, string newEmail)
    {
        if (!EmailValidator.IsValid(newEmail))
            throw new ValidationException("A valid email address is required.");
        AdminCredential cred = await GetOrCreateCredentialAsync();
        if (!CredentialHelper.VerifyPassword(cred, currentPassword, _passwordService))
            return null;
        string normalizedEmail = newEmail.Trim().ToLowerInvariant();
        if (string.Equals(normalizedEmail, cred.Email, StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("New email must be different from the current email.");
        cred.Email = normalizedEmail;
        await _credentialRepository.SaveChangesAsync();
        return _jwtTokenService.Generate(cred.Email);
    }

    public virtual async Task<bool> ResetPasswordAsync(string resetToken, string newPassword)
    {
        if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 6)
            throw new ValidationException("Password must be at least 6 characters.");
        AdminCredential? cred = await _credentialRepository.GetByResetTokenAsync(resetToken);
        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    // First-run bootstrap: reads Admin:Email / Admin:Password from config with env-var
    // fallbacks (ADMIN_EMAIL / ADMIN_PASSWORD), hashing the initial password via
    // IPasswordService. Throws if no password is configured.
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
            throw new InfrastructureException(
                "Admin:Password must be configured before first use. Set it via ADMIN_PASSWORD env var.");

        (string hash, string salt) = _passwordService.Hash(password);
        cred = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt };
        await _credentialRepository.AddAsync(cred);
        return cred;
    }
}
