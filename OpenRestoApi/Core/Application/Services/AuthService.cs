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
    ICurrentUserService currentUser,
    IAuditScope? audit = null) : IAuthService
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly IJwtTokenService _jwtTokenService = jwtTokenService;
    private readonly ICurrentUserService _currentUser = currentUser;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public virtual async Task<string?> LoginAsync(string email, string password)
    {
        string attempted = email ?? string.Empty;
        AdminCredential? cred = await _credentialRepository.GetByEmailAsync(attempted);
        // Unknown email, deactivated account, and wrong password are deliberately
        // indistinguishable to the caller — the controller turns all three into the same 401.
        if (cred == null || !cred.IsActive)
            return RecordFailedLogin(attempted);
        if (!CredentialHelper.VerifyPassword(cred, password, _passwordService))
            return RecordFailedLogin(attempted);

        AttributeTo(cred);
        Describe(AuditActions.AuthLogin, cred, "Signed in");
        return _jwtTokenService.Generate(cred.Id, cred.Email, cred.Role);
    }

    /// <summary>
    /// The attempted address is the point of the entry, but the summary stays as uninformative as
    /// the 401 the caller gets: whether the address exists is not something a rejected attempt
    /// gets to learn from the audit trail either.
    /// </summary>
    private string? RecordFailedLogin(string attemptedEmail)
    {
        _audit.AttributeTo(null, attemptedEmail, role: string.Empty);
        _audit.Describe(AuditActions.AuthLoginFailed, summary: "Failed sign-in attempt");
        return null;
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
        string previousHash = cred.PasswordHash;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        await _credentialRepository.SaveChangesAsync();

        _audit.RecordChange("passwordHash", previousHash, cred.PasswordHash);
        Describe(AuditActions.AuthPasswordChange, cred, $"Changed the password for {cred.Email}");
        return true;
    }

    public virtual async Task<string?> ChangeEmailAsync(string currentPassword, string newEmail)
    {
        string normalizedEmail = UserFields.NormalizeEmail(newEmail);
        AdminCredential? cred = await ResolveCurrentUserAsync();
        if (cred == null || !CredentialHelper.VerifyPassword(cred, currentPassword, _passwordService))
            return null;
        if (string.Equals(normalizedEmail, cred.Email, StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("New email must be different from the current email.") { Code = ErrorCodes.AuthEmailUnchanged };

        AdminCredential? existing = await _credentialRepository.GetByEmailAsync(normalizedEmail);
        if (existing != null && existing.Id != cred.Id)
            throw new BusinessRuleException("That email address is already in use.") { Code = ErrorCodes.AuthEmailAlreadyInUse };

        string previousEmail = cred.Email;
        cred.Email = normalizedEmail;
        await _credentialRepository.SaveChangesAsync();

        _audit.RecordChange("email", previousEmail, normalizedEmail);
        Describe(AuditActions.AuthEmailChange, cred,
            $"Changed the sign-in email from {previousEmail} to {normalizedEmail}");
        // Re-mint so the token's email claim matches the row it identifies.
        return _jwtTokenService.Generate(cred.Id, cred.Email, cred.Role);
    }

    public virtual async Task<bool> ResetPasswordAsync(string resetToken, string newPassword)
    {
        UserFields.ValidatePassword(newPassword);
        AdminCredential? cred = await _credentialRepository.GetByResetTokenAsync(resetToken);
        if (cred == null || cred.ResetTokenExpiry < DateTime.UtcNow)
            return false;
        string previousHash = cred.PasswordHash;
        (cred.PasswordHash, cred.PasswordSalt) = _passwordService.Hash(newPassword);
        cred.ResetToken = null;
        cred.ResetTokenExpiry = null;
        await _credentialRepository.SaveChangesAsync();

        // The reset arrives with a token rather than a session, so the actor is whoever the token
        // resolved to — the request's claims would name nobody.
        AttributeTo(cred);
        _audit.RecordChange("passwordHash", previousHash, cred.PasswordHash);
        Describe(AuditActions.AuthPasswordReset, cred, $"Reset the password for {cred.Email}");
        return true;
    }

    private void AttributeTo(AdminCredential cred)
        => _audit.AttributeTo(cred.Id, cred.Email, cred.DisplayName, cred.Role);

    private void Describe(string action, AdminCredential cred, string summary)
        => _audit.Describe(action, AuditTargets.User, AuditTargets.IdOf(cred.Id),
            UserFields.PersonLabel(cred.DisplayName, cred.Email), summary: summary);

    private Task<AdminCredential?> ResolveCurrentUserAsync()
        => CurrentUserResolver.ResolveAsync(_currentUser, _credentialRepository);
}
