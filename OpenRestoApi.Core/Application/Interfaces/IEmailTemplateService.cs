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

    /// <summary>
    /// Subject line of the confirmation email. Lives beside the body so the send path and the
    /// admin's preview render the same header, rather than each spelling the wording out.
    /// </summary>
    string BuildConfirmationSubject(Restaurant restaurant);

    /// <summary>
    /// Subject of the email a location receives when a booking is created or cancelled
    /// .
    /// </summary>
    string BuildRestaurantAlertSubject(Booking booking, Restaurant restaurant, RestaurantAlertKind kind);

    /// <summary>
    /// Body of that email: who booked, for how many, when in the location's own clock, where
    /// they sit, the reference, and a link to the booking in the admin.
    /// </summary>
    string BuildRestaurantAlertEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl, RestaurantAlertKind kind);
}
