using OpenRestoApi.Core.Application.Exceptions;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Normalization + validation for the optional contact fields shared by
/// <see cref="Domain.Restaurant"/> and <see cref="Domain.BrandSettings"/>. Both levels accept the
/// same values and follow the same PATCH convention — a blank string clears the field, a non-blank
/// one is trimmed and bounds-checked — so the rule lives here rather than being restated in
/// <c>RestaurantManagementService</c> and <c>BrandService</c>.
/// </summary>
public static class ContactFields
{
    /// <summary>
    /// Returns the value to store for a contact phone: null when <paramref name="phone"/> is
    /// blank, otherwise the trimmed number. Throws when the trimmed value exceeds
    /// <see cref="ContactLimits.MaxPhoneLength"/>. Format is intentionally unconstrained — phone
    /// numbers are written a hundred different ways and the field is display-only.
    /// </summary>
    public static string? NormalizePhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        string trimmed = phone.Trim();
        if (trimmed.Length > ContactLimits.MaxPhoneLength)
        {
            throw new ValidationException(
                $"Phone number cannot exceed {ContactLimits.MaxPhoneLength} characters.")
            { Code = ErrorCodes.ContactPhoneTooLong };
        }

        return trimmed;
    }

    /// <summary>
    /// Returns the value to store for a contact email: null when <paramref name="email"/> is blank,
    /// otherwise the trimmed address. Throws when it exceeds
    /// <see cref="ContactLimits.MaxEmailLength"/> or fails the loose
    /// <see cref="EmailValidator"/> shape check every other email input in the app already uses.
    /// </summary>
    public static string? NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        string trimmed = email.Trim();
        if (trimmed.Length > ContactLimits.MaxEmailLength)
        {
            throw new ValidationException(
                $"Email address cannot exceed {ContactLimits.MaxEmailLength} characters.")
            { Code = ErrorCodes.ContactEmailTooLong };
        }

        if (!EmailValidator.IsValid(trimmed))
        {
            throw new ValidationException("Email address must be a valid email address.") { Code = ErrorCodes.ContactEmailInvalid };
        }

        return trimmed;
    }
}
