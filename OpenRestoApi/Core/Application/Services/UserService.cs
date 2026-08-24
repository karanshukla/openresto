using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Owner-facing management of admin accounts. Who is <em>allowed</em> to call this is decided
/// entirely by the <see cref="AuthPolicies.RequireOwner"/> policy on the controller — nothing
/// here branches on the caller's role, so moving to fine-grained permissions later is a change
/// to the policy definitions alone. What this class owns is the business rules: the instance
/// must keep at least one active Owner, and you cannot lock yourself out.
/// </summary>
public class UserService(
    IAdminCredentialRepository credentialRepository,
    IPasswordService passwordService,
    ICurrentUserService currentUser,
    IAuditScope? audit = null)
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly ICurrentUserService _currentUser = currentUser;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public async Task<List<UserDto>> GetAllAsync()
    {
        List<AdminCredential> users = await _credentialRepository.GetAllAsync();
        return users.Select(UserMapper.ToDto).ToList();
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest req)
    {
        string email = UserFields.NormalizeEmail(req.Email);
        UserFields.ValidatePassword(req.Password);
        string role = UserFields.NormalizeRole(req.Role);
        string? displayName = UserFields.NormalizeDisplayName(req.DisplayName);

        if (await _credentialRepository.GetByEmailAsync(email) != null)
        {
            throw new BusinessRuleException("An account with that email address already exists.") { Code = ErrorCodes.UserEmailAlreadyExists };
        }

        (string hash, string salt) = _passwordService.Hash(req.Password);
        var user = new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            DisplayName = displayName,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        await _credentialRepository.AddAsync(user);

        Describe(AuditActions.UserCreate, user, $"Created a {role} account for {email}");
        return UserMapper.ToDto(user);
    }

    public async Task<UserDto> UpdateRoleAsync(int id, UpdateUserRoleRequest req)
    {
        string role = UserFields.NormalizeRole(req.Role);
        AdminCredential user = await RequireUserAsync(id);

        if (user.Role != role)
        {
            // Same reasoning as deactivating yourself: dropping your own Owner role revokes
            // your access to this very screen, so it takes another Owner to do it to you.
            if (IsSelf(user))
            {
                throw new BusinessRuleException("You cannot change your own role.") { Code = ErrorCodes.UserCannotChangeOwnRole };
            }

            await EnsureAnotherActiveOwnerRemainsAsync(user, "demote");
            string previousRole = user.Role;
            user.Role = role;
            await _credentialRepository.SaveChangesAsync();

            _audit.RecordChange("role", previousRole, role);
            Describe(AuditActions.UserRoleChange, user,
                $"Changed {DisplayNameOf(user)}'s role from {previousRole} to {role}");
        }

        return UserMapper.ToDto(user);
    }

    public async Task<UserDto> SetActiveAsync(int id, SetUserActiveRequest req)
    {
        AdminCredential user = await RequireUserAsync(id);

        if (user.IsActive != req.IsActive)
        {
            if (!req.IsActive)
            {
                if (IsSelf(user))
                {
                    throw new BusinessRuleException("You cannot deactivate your own account.") { Code = ErrorCodes.UserCannotDeactivateSelf };
                }

                await EnsureAnotherActiveOwnerRemainsAsync(user, "deactivate");
            }

            user.IsActive = req.IsActive;
            await _credentialRepository.SaveChangesAsync();

            _audit.RecordChange("isActive", !req.IsActive, req.IsActive);
            Describe(
                req.IsActive ? AuditActions.UserActivate : AuditActions.UserDeactivate,
                user,
                req.IsActive
                    ? $"Reactivated {DisplayNameOf(user)}'s account"
                    : $"Deactivated {DisplayNameOf(user)}'s account");
        }

        return UserMapper.ToDto(user);
    }

    /// <summary>
    /// Sets a new password on another account — the out-of-band recovery path for a user who
    /// never configured a security question. Any outstanding self-service reset token is
    /// dropped so the old one can't be replayed afterwards.
    /// </summary>
    public async Task<UserDto> ResetPasswordAsync(int id, ResetUserPasswordRequest req)
    {
        UserFields.ValidatePassword(req.NewPassword);
        AdminCredential user = await RequireUserAsync(id);

        string previousHash = user.PasswordHash;
        (user.PasswordHash, user.PasswordSalt) = _passwordService.Hash(req.NewPassword);
        user.ResetToken = null;
        user.ResetTokenExpiry = null;
        await _credentialRepository.SaveChangesAsync();

        _audit.RecordChange("passwordHash", previousHash, user.PasswordHash);
        Describe(AuditActions.UserPasswordReset, user,
            $"Reset the password for {DisplayNameOf(user)}");
        return UserMapper.ToDto(user);
    }

    private void Describe(string action, AdminCredential user, string summary)
        => _audit.Describe(action, AuditTargets.User, AuditTargets.IdOf(user.Id), DisplayNameOf(user),
            summary: summary);

    private static string DisplayNameOf(AdminCredential user)
        => UserFields.PersonLabel(user.DisplayName, user.Email);

    private async Task<AdminCredential> RequireUserAsync(int id)
        => await _credentialRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"User {id} not found.") { Code = ErrorCodes.UserNotFound };

    private bool IsSelf(AdminCredential user)
        => _currentUser.UserId == user.Id
            || string.Equals(_currentUser.Email, user.Email, StringComparison.OrdinalIgnoreCase);

    // Losing the last active Owner would leave the instance with nobody able to manage users —
    // unrecoverable through the UI. Only an active Owner counts, so deactivating one and then
    // demoting it isn't a way around the rule either.
    private async Task EnsureAnotherActiveOwnerRemainsAsync(AdminCredential user, string action)
    {
        if (user.Role != UserRoles.Owner || !user.IsActive)
        {
            return;
        }

        int activeOwners = await _credentialRepository.CountActiveByRoleAsync(UserRoles.Owner);
        if (activeOwners <= 1)
        {
            throw new BusinessRuleException(
                $"Cannot {action} the last active {UserRoles.Owner}. Promote another user first.")
            { Code = ErrorCodes.UserLastActiveOwner };
        }
    }
}
