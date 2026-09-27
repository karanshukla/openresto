using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Admin-credential verification helpers. Pure delegation over
/// <see cref="IPasswordService"/> — extracts the identical
/// <c>passwordService.Verify(password, cred.PasswordHash, cred.PasswordSalt)</c>
/// pattern previously inlined at three <c>AuthService</c> call sites.
/// Matches the static-helper convention (<see cref="OpeningHoursHelper"/>,
/// <see cref="WalkInHelper"/>) rather than adding a service-dependent instance
/// method to the anemic <see cref="AdminCredential"/> entity.
/// </summary>
public static class CredentialHelper
{
    /// <summary>
    /// True when <paramref name="password"/> verifies against <paramref name="credential"/>'s
    /// stored hash/salt via <paramref name="passwordService"/>.
    /// </summary>
    public static bool VerifyPassword(AdminCredential credential, string password, IPasswordService passwordService)
        => passwordService.Verify(password, credential.PasswordHash, credential.PasswordSalt);
}
