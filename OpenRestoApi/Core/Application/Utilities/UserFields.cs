using OpenRestoApi.Core.Application.Exceptions;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Normalization + bounds for the writable fields of an admin user account. Shared by the
/// first-run bootstrap, self-service email change, and Owner-driven user management so all
/// three store identically-shaped values — which is what lets the unique index on
/// <c>AdminCredentials.Email</c> stand in for case-insensitive uniqueness.
/// </summary>
public static class UserFields
{
    public const int MaxDisplayNameLength = 80;
    public const int MaxRoleLength = 32;
    public const int MinPasswordLength = 6;

    /// <summary>
    /// Trims and lower-cases an email for storage. Throws <see cref="ValidationException"/>
    /// when it fails the loose <see cref="EmailValidator"/> shape check or exceeds
    /// <see cref="ContactLimits.MaxEmailLength"/>.
    /// </summary>
    public static string NormalizeEmail(string? email)
    {
        if (!EmailValidator.IsValid(email))
        {
            throw new ValidationException("A valid email address is required.");
        }

        string normalized = email!.Trim().ToLowerInvariant();
        if (normalized.Length > ContactLimits.MaxEmailLength)
        {
            throw new ValidationException(
                $"Email address cannot exceed {ContactLimits.MaxEmailLength} characters.");
        }

        return normalized;
    }

    /// <summary>
    /// Returns the value to store for a display name: null when blank (the UI falls back to the
    /// email), otherwise the trimmed name. Throws when it exceeds
    /// <see cref="MaxDisplayNameLength"/>.
    /// </summary>
    public static string? NormalizeDisplayName(string? displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return null;
        }

        string trimmed = displayName.Trim();
        if (trimmed.Length > MaxDisplayNameLength)
        {
            throw new ValidationException(
                $"Display name cannot exceed {MaxDisplayNameLength} characters.");
        }

        return trimmed;
    }

    /// <summary>
    /// How a person is named wherever the admin shows one: the display name they set, else the
    /// email they sign in with. The counterpart of <see cref="NormalizeDisplayName"/> storing null
    /// for a blank name, and the same rule the frontend applies in <c>utils/audit.ts</c>.
    /// </summary>
    public static string PersonLabel(string? displayName, string email)
        => string.IsNullOrWhiteSpace(displayName) ? email : displayName;

    /// <summary>Throws <see cref="ValidationException"/> unless the password meets the minimum length.</summary>
    public static void ValidatePassword(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinPasswordLength)
        {
            throw new ValidationException($"Password must be at least {MinPasswordLength} characters.");
        }
    }

    /// <summary>Returns the canonical role string, throwing when it is not assignable.</summary>
    public static string NormalizeRole(string? role)
    {
        return UserRoles.Normalise(role)
            ?? throw new ValidationException(
                $"Role must be one of: {string.Join(", ", UserRoles.Assignable.Order())}.");
    }
}
