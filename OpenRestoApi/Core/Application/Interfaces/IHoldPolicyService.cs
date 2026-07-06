using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Outcome of validating a hold request against restaurant policy (open hours,
/// walk-in days, pause window, past-date guard) and any existing confirmed
/// booking on the same table. The controller maps <see cref="HoldPolicyStatus"/>
/// to HTTP status codes; the service has no HTTP surface.
/// </summary>
/// <summary>
/// <see cref="Rejected"/> covers policy violations (past date, paused, walk-in, closed) that map
/// to HTTP 400. <see cref="Booked"/> is a distinct outcome for a conflict with an existing
/// confirmed booking — it maps to HTTP 409, preserving the controller's original status code.
/// </summary>
public enum HoldPolicyStatus { Eligible, NotFound, Rejected, Booked }

/// <summary>
/// Eligible holds carry the resolved <see cref="Restaurant"/> and the timezone-normalized
/// UTC booking date so the caller can place the hold without re-fetching. Rejected/Booked/
/// NotFound results carry <see cref="FailureMessage"/> instead.
/// </summary>
public record HoldPolicyResult(
    HoldPolicyStatus Status,
    Restaurant? Restaurant = null,
    DateTime BookingDate = default,
    string? FailureMessage = null)
{
    public static HoldPolicyResult NotFound() => new(HoldPolicyStatus.NotFound);
    public static HoldPolicyResult Rejected(string message) => new(HoldPolicyStatus.Rejected, FailureMessage: message);
    public static HoldPolicyResult Booked(string message) => new(HoldPolicyStatus.Booked, FailureMessage: message);
    public static HoldPolicyResult Eligible(Restaurant restaurant, DateTime bookingDate)
        => new(HoldPolicyStatus.Eligible, restaurant, bookingDate);
}

/// <summary>
/// Pre-flight validation for a table hold: resolves the restaurant, normalizes the
/// requested date to UTC using the restaurant's timezone, and enforces the same
/// open-hours / walk-in / pause / past-date rules as <c>BookingService</c>, then
/// checks for a conflicting confirmed booking. Delegates timezone parsing to
/// <c>TimeZoneHelper</c>, opening-hours resolution to <c>OpeningHoursHelper</c>,
/// and walk-in policy to <c>WalkInHelper</c>.
/// </summary>
public interface IHoldPolicyService
{
    /// <summary>
    /// Validates the hold request. Returns <see cref="HoldPolicyStatus.Eligible"/> with the
    /// resolved restaurant + UTC booking date only when every policy check passes AND no
    /// confirmed booking overlaps the table. Never throws for expected policy violations.
    /// </summary>
    Task<HoldPolicyResult> ValidateAsync(int restaurantId, int tableId, DateTime requestedDate);
}
