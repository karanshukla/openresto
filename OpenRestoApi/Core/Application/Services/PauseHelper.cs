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
    public static string RejectionMessage(Restaurant restaurant)
    {
        if (!restaurant.BookingsPausedUntil.HasValue)
        {
            return "Bookings for this restaurant are currently paused. Please try again later.";
        }

        DateTime localEnd = TimeZoneHelper.ConvertUtcToLocal(restaurant.BookingsPausedUntil.Value, restaurant.Timezone);
        return $"Bookings are paused until {localEnd.ToString("HH:mm", CultureInfo.InvariantCulture)}. Please choose a later time.";
    }
}
