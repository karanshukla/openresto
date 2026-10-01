using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Turns the claims on the request into the account row they name. Shared by every service
/// that acts "as the caller" (<see cref="AuthService"/>, <see cref="SecurityQuestionsService"/>,
/// <see cref="UserService"/>) so they all apply the same two rules: the id claim is the stable
/// identity, and a deactivated account resolves to nothing.
/// </summary>
public static class CurrentUserResolver
{
    /// <summary>
    /// The active account named by the caller's claims, or null. Tokens minted before
    /// multi-user support carry no id claim, so the email claim is honoured as a fallback
    /// rather than logging those in-flight sessions out.
    /// </summary>
    public static Task<AdminCredential?> ResolveAsync(
        ICurrentUserService currentUser,
        IAdminCredentialRepository credentialRepository)
        => ResolveAsync(currentUser.UserId, currentUser.Email, credentialRepository);

    /// <inheritdoc cref="ResolveAsync(ICurrentUserService, IAdminCredentialRepository)"/>
    public static async Task<AdminCredential?> ResolveAsync(
        int? userId,
        string? email,
        IAdminCredentialRepository credentialRepository)
    {
        AdminCredential? cred = userId.HasValue
            ? await credentialRepository.GetByIdAsync(userId.Value)
            : null;

        if (cred == null && !string.IsNullOrWhiteSpace(email))
            cred = await credentialRepository.GetByEmailAsync(email);

        return cred?.IsActive == true ? cred : null;
    }
}
