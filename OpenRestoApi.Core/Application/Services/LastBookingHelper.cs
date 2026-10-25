using System.Globalization;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Wording for a booking or hold turned away because it would start after the day's last
/// booking time. Booking creation and hold placement reject on the same rule
/// (<see cref="Restaurant.IsAcceptingBookingsAt"/>), so they say the same thing, and both name
/// the cutoff, because the diner's next move is to pick an earlier slot.
/// </summary>
public static class LastBookingHelper
{
    public readonly record struct Rejection(
        string Message,
        string Code,
        IReadOnlyDictionary<string, object>? Args);

    /// <summary>
    /// The cutoff the sitting at <paramref name="bookingUtc"/> ran past, in the restaurant's
    /// own clock. The sitting may belong to the previous day's overnight service, so the cutoff
    /// is looked up for whichever service reaches the instant.
    /// </summary>
    /// <seealso>LastBookingHelperTests.RejectionFor_NamesTheCutoffOfTheServiceTheSittingBelongsTo</seealso>
    public static Rejection RejectionFor(Restaurant restaurant, DateTime bookingUtc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(bookingUtc, restaurant.Timezone);
        DateTime? cutoff = ServiceWindowHelper.LastBookingCutoffFor(restaurant, local.Date, IsoDay.Of(local.Date));
        if (cutoff is null || local <= cutoff)
        {
            DateTime dayBefore = local.Date.AddDays(-1);
            cutoff = ServiceWindowHelper.LastBookingCutoffFor(restaurant, dayBefore, IsoDay.Of(dayBefore));
        }

        string time = (cutoff ?? local).ToString("HH:mm", CultureInfo.InvariantCulture);
        return new Rejection(
            $"The last booking for that day is at {time}. Please choose an earlier time.",
            ErrorCodes.RestaurantPastLastBooking,
            new Dictionary<string, object> { ["time"] = time });
    }
}
