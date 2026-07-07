using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Renders the HTML body of booking-related transactional emails. Pure function —
/// no I/O, no side effects. Output is wrapped via <c>EmailTemplateBuilder.Wrap</c>.
/// </summary>
public interface IEmailTemplateService
{
    /// <summary>
    /// Builds the booking-confirmation email HTML for a persisted booking. Timezone
    /// conversions use the restaurant's IANA timezone; date/time formatting via
    /// <c>DateFormatter</c>; URLs are RFC-3986 escaped.
    /// </summary>
    string BuildConfirmationEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl);
}
