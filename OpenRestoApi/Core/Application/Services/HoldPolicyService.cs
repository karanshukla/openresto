using System.Globalization;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Pre-flight validation for table holds. Enforces the same open-hours / walk-in /
/// pause / past-date policy as <c>BookingService.CreateBookingAsync</c>, then checks
/// for a conflicting confirmed booking. Extracted from <c>HoldsController</c> so the
/// controller is a thin HTTP mapper. Stateless apart from its repository dependencies;
/// safe to share one Scoped instance per request.
/// </summary>
public sealed class HoldPolicyService(
    IRestaurantRepository restaurantRepository,
    IBookingRepository bookingRepository) : IHoldPolicyService
{
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IBookingRepository _bookingRepository = bookingRepository;

    public async Task<HoldPolicyResult> ValidateAsync(int restaurantId, int tableId, DateTime requestedDate)
    {
        // 1. Fetch restaurant first to get its timezone.
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return HoldPolicyResult.NotFound();
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC.
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(requestedDate, restaurant.Timezone);

        // 3. Past-date guard (5-minute tolerance for clock skew).
        if (bookingDate < DateTime.UtcNow.AddMinutes(-5))
        {
            return HoldPolicyResult.Rejected("Cannot hold a table for a past time.");
        }

        // 4. Pause window.
        if (restaurant.BookingsPausedUntil.HasValue && restaurant.BookingsPausedUntil.Value > DateTime.UtcNow)
        {
            return HoldPolicyResult.Rejected("Bookings are currently paused for this restaurant.");
        }

        // 5. Walk-in-only policy (location-wide or per ISO day).
        if (WalkInHelper.IsWalkInOnlyAt(restaurant, bookingDate))
        {
            return HoldPolicyResult.Rejected(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day.");
        }

        // 6. Operating hours / open days.
        if (!IsTimeWithinOpeningHours(restaurant, bookingDate))
        {
            return HoldPolicyResult.Rejected("The restaurant is closed at the requested time.");
        }

        // 7. Existing confirmed booking on the same table.
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            tableId, bookingDate, restaurant.DefaultBookingDurationMinutes);
        if (alreadyBooked)
        {
            return HoldPolicyResult.Booked("This table is already booked for that time.");
        }

        return HoldPolicyResult.Eligible(restaurant, bookingDate);
    }

    private static bool IsTimeWithinOpeningHours(Restaurant restaurant, DateTime requestedUtc)
    {
        DateTime localTime = TimeZoneHelper.ConvertUtcToLocal(requestedUtc, restaurant.Timezone);

        int isoDay = (int)localTime.DayOfWeek;
        if (isoDay == 0)
        {
            isoDay = 7; // Sunday: 0 -> 7
        }

        // Check OpenDays
        if (!string.IsNullOrEmpty(restaurant.OpenDays))
        {
            var openDaysList = restaurant.OpenDays.Split(',').Select(s => s.Trim());
            if (!openDaysList.Contains(isoDay.ToString(CultureInfo.InvariantCulture)))
            {
                return false;
            }
        }

        (string openTime, string closeTime) = OpeningHoursHelper.GetHoursForDay(restaurant, isoDay);
        if (!OpeningHoursHelper.TryParseTime(openTime, out int openHour, out int openMin))
        {
            openHour = 9; openMin = 0;
        }
        if (!OpeningHoursHelper.TryParseTime(closeTime, out int closeHour, out int closeMin))
        {
            closeHour = 22; closeMin = 0;
        }

        TimeSpan open = new TimeSpan(openHour, openMin, 0);
        TimeSpan close = new TimeSpan(closeHour, closeMin, 0);
        TimeSpan current = localTime.TimeOfDay;

        if (close > open)
        {
            return current >= open && current < close;
        }
        else if (close < open)
        {
            // Closes after midnight (e.g. 18:00 to 02:00)
            return current >= open || current < close;
        }
        else
        {
            // close == open usually means 24h
            return true;
        }
    }
}
