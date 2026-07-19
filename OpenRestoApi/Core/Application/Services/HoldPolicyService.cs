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
        HoldPolicyResult restaurantPolicy = await ValidateRestaurantPolicyAsync(restaurantId, requestedDate);
        if (restaurantPolicy.Status != HoldPolicyStatus.Eligible)
        {
            return restaurantPolicy;
        }

        // Existing confirmed booking on the same table.
        DateTime bookingDate = restaurantPolicy.BookingDate;
        Restaurant restaurant = restaurantPolicy.Restaurant!;
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            tableId, bookingDate, restaurant.DefaultBookingDurationMinutes);
        if (alreadyBooked)
        {
            return HoldPolicyResult.Booked("This table is already booked for that time.");
        }

        return restaurantPolicy;
    }

    public async Task<HoldPolicyResult> ValidateAnyTableAsync(int restaurantId, DateTime requestedDate)
    {
        // Same restaurant-level policy gates as ValidateAsync, but no per-table booking
        // check — the caller will compute the candidate pool and HoldService.PlaceAutoHold
        // will atomically pick the first free table under its lock.
        return await ValidateRestaurantPolicyAsync(restaurantId, requestedDate);
    }

    /// <summary>
    /// Shared restaurant-level policy checks (1–6 of the original ValidateAsync): fetch +
    /// timezone-normalize + past-date + pause + walk-in + operating hours. Returns
    /// <see cref="HoldPolicyStatus.Eligible"/> with the resolved restaurant and UTC booking
    /// date, or the appropriate rejection status. The per-table booking check is left to
    /// the callers because auto-assign needs to evaluate it per-candidate, not upfront.
    /// </summary>
    private async Task<HoldPolicyResult> ValidateRestaurantPolicyAsync(int restaurantId, DateTime requestedDate)
    {
        // 1. Fetch restaurant first to get its timezone.
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return HoldPolicyResult.NotFound();
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC.
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(requestedDate, restaurant.Timezone);

        // 3. Past-date guard (same 5-min tolerance as booking create/cancel).
        if (bookingDate < DateTime.UtcNow.AddMinutes(-Booking.CancellationGraceMinutes))
        {
            return HoldPolicyResult.Rejected("Cannot hold a table for a past time.");
        }

        // 4. Pause window.
        if (restaurant.IsPaused())
        {
            return HoldPolicyResult.Rejected("Bookings are currently paused for this restaurant.");
        }

        // 5. Walk-in-only policy (location-wide or per ISO day).
        if (restaurant.IsWalkInOnlyAt(bookingDate))
        {
            return HoldPolicyResult.Rejected(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day.");
        }

        // 6. Operating hours / open days.
        if (!restaurant.IsOpenAt(bookingDate))
        {
            return HoldPolicyResult.Rejected("The restaurant is closed at the requested time.");
        }

        return HoldPolicyResult.Eligible(restaurant, bookingDate);
    }
}
