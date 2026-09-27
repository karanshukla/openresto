using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Orchestrates the post-creation booking confirmation email: resolves SMTP settings,
/// checks the <c>SendBookingConfirmations</c> flag, renders the template, sends via SMTP,
/// and logs failures to <c>IEmailFailureRepository</c>. Best-effort — never throws;
/// the caller's booking transaction must not roll back on email failure.
/// </summary>
public interface IBookingConfirmationService
{
    /// <summary>
    /// Sends the confirmation email for a freshly-persisted booking. Silently no-ops
    /// when the recipient has no email, SMTP is unconfigured, or the admin disabled
    /// confirmations. All exceptions are swallowed and recorded as <c>EmailFailure</c>.
    /// </summary>
    Task SendConfirmationAsync(Booking booking, Restaurant restaurant);
}
