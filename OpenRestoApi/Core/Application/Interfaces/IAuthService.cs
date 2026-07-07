namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Admin authentication orchestration: login, password change, email change, and
/// token-based password reset. Delegates hashing to <see cref="IPasswordService"/>,
/// JWT minting to <see cref="IJwtTokenService"/>, and PVQ to
/// <see cref="ISecurityQuestionsService"/>.
/// </summary>
public interface IAuthService
{
    Task<string?> LoginAsync(string email, string password);
    Task<bool> ChangePasswordAsync(string currentPassword, string newPassword);
    Task<string?> ChangeEmailAsync(string currentPassword, string newEmail);
    Task<bool> ResetPasswordAsync(string resetToken, string newPassword);
}
