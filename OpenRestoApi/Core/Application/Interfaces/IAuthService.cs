using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Admin authentication orchestration: login, password change, email change, and
/// token-based password reset. Delegates hashing to <see cref="IPasswordService"/>,
/// JWT minting to <see cref="IJwtTokenService"/>, and PVQ to
/// <see cref="ISecurityQuestionsService"/>. Everything except login and reset-by-token
/// acts on the caller identified by <see cref="ICurrentUserService"/>.
/// </summary>
public interface IAuthService
{
    Task<string?> LoginAsync(string email, string password);

    /// <summary>The signed-in caller's identity, or null when the token names no live account.</summary>
    Task<CurrentUserDto?> GetCurrentUserAsync();

    Task<bool> ChangePasswordAsync(string currentPassword, string newPassword);
    Task<string?> ChangeEmailAsync(string currentPassword, string newEmail);
    Task<bool> ResetPasswordAsync(string resetToken, string newPassword);
}
