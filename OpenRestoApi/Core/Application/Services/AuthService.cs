using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Admin authentication orchestrator. Delegates password hashing to
/// <see cref="IPasswordService"/>, JWT minting to <see cref="IJwtTokenService"/>, and
/// PVQ/reset-question concerns to <see cref="ISecurityQuestionsService"/>.
/// Every self-service operation targets the caller resolved from
/// <see cref="ICurrentUserService"/> — never "the" credential row.
/// </summary>
public class AuthService(
    IAdminCredentialRepository credentialRepository,
    IPasswordService passwordService,
    IJwtTokenService jwtTokenService,
    ICurrentUserService currentUser) : IAuthService
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly IJwtTokenService _jwtTokenService = jwtTokenService;
    private readonly ICurrentUserService _currentUser = currentUser;

    public virtual async Task<string?> LoginAsync(string email, string password)
    {
        AdminCredential? cred = await _credentialRepository.GetByEmailAsync(email ?? string.Empty);
        // Unknown email, deactivated account, and wrong password are deliberately
        // indistinguishable to the caller — the controller turns all three into the same 401.
        if (cred == null || !cred.IsActive)
            return null;
        if (!CredentialHelper.VerifyPassword(cred, password, _passwordService))
            return null;
        return _jwtTokenService.Generate(cred.Id, cred.Email, cred.Role);
    }

    public virtual async Task<CurrentUserDto?> GetCurrentUserAsync()
    {
        AdminCredential? cred = await ResolveCurrentUserAsync();
        return cred == null ? null : UserMapper.ToCurrentUserDto(cred);
    }

    public virtual async Task<bool> ChangePasswordAsync(string currentPassword, string newPassword)
    {
        UserFields.ValidatePassword(newPassword);
        AdminCredential? cred = await ResolveCurrentUserAsync();
        if (cred == null || !CredentialHelper.VerifyPassword(cred, currentPassword, _passwordService))
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<string?> ChangeEmailAsync(string currentPassword, string newEmail)
    {
        string normalizedEmail = UserFields.NormalizeEmail(newEmail);
        AdminCredential? cred = await ResolveCurrentUserAsync();
        if (cred == null || !CredentialHelper.VerifyPassword(cred, currentPassword, _passwordService))
            return null;
        if (string.Equals(normalizedEmail, cred.Email, StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("New email must be different from the current email.");

        AdminCredential? existing = await _credentialRepository.GetByEmailAsync(normalizedEmail);
        if (existing != null && existing.Id != cred.Id)
            throw new BusinessRuleException("That email address is already in use.");

        cred.Email = normalizedEmail;
        await _credentialRepository.SaveChangesAsync();
        // Re-mint so the token's email claim matches the row it identifies.
        return _jwtTokenService.Generate(cred.Id, cred.Email, cred.Role);
    }

    public virtual async Task<bool> ResetPasswordAsync(string resetToken, string newPassword)
    {
        UserFields.ValidatePassword(newPassword);
        AdminCredential? cred = await _credentialRepository.GetByResetTokenAsync(resetToken);
        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
            return false;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _credentialRepository.SaveChangesAsync();
        return true;
    }

    private Task<AdminCredential?> ResolveCurrentUserAsync()
        => CurrentUserResolver.ResolveAsync(_currentUser, _credentialRepository);
}
