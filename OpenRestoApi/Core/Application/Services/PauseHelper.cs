using System.Globalization;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Wording for a booking or hold turned away by an active pause window. Booking creation and
/// hold placement reject on the same rule (<see cref="Restaurant.IsPausedFor"/>), so they say
/// the same thing — and both name the time the pause lifts, because the diner's next move is
/// to pick a later slot rather than to come back later.
/// </summary>
public static class PauseHelper
{
    /// <summary>
    /// How a paused restaurant turns a booking or hold away: the English wording, the code a
    /// client renders its own wording from, and the values that wording interpolates. A pause
    /// with an end and one without are different sentences, so they carry different codes —
    /// a client cannot branch on the presence of an argument.
    /// </summary>
    public readonly record struct Rejection(
        string Message,
        string Code,
        IReadOnlyDictionary<string, object>? Args);

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>PauseHelperTests.Rejection_WithEndTime_NamesTheTimeAndCarriesItAsAnArg</seealso>
    /// <seealso>PauseHelperTests.Rejection_WithoutEndTime_UsesTheIndefiniteCode</seealso>
    public static Rejection RejectionFor(Restaurant restaurant)
    {
        if (!restaurant.BookingsPausedUntil.HasValue)
        {
            return new Rejection(
                "Bookings for this restaurant are currently paused. Please try again later.",
                ErrorCodes.BookingPausedIndefinitely,
                null);
        }

        DateTime localEnd = TimeZoneHelper.ConvertUtcToLocal(restaurant.BookingsPausedUntil.Value, restaurant.Timezone);
        string until = localEnd.ToString("HH:mm", CultureInfo.InvariantCulture);
        return new Rejection(
            $"Bookings are paused until {until}. Please choose a later time.",
            ErrorCodes.BookingPaused,
            new Dictionary<string, object> { ["until"] = until });
    }

    public static string RejectionMessage(Restaurant restaurant) => RejectionFor(restaurant).Message;
}
