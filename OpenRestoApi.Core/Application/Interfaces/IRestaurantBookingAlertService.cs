using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Emails the location when a booking lands on its book or leaves it, the email counterpart of
/// the admin Web Push. Gated on <c>EmailSettings.SendRestaurantBookingAlerts</c> and addressed to
/// the location's contact email, falling back to the brand's. Best-effort: never throws, and
/// records a failed send as an <c>EmailFailure</c> the way guest confirmations do. Runs from the
/// notification worker, never on the request that took the booking.
/// </summary>
/// <summary>Which booking event a location is being told about.</summary>
public enum RestaurantAlertKind
{
    Created,
    Cancelled,
}

public interface IRestaurantBookingAlertService
{
    Task SendBookingCreatedAsync(Booking booking);
    Task SendBookingCancelledAsync(Booking booking);
}
