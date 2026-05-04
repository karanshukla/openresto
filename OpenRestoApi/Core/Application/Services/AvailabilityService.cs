using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class AvailabilityService(
    IBookingRepository bookingRepository,
    IRestaurantRepository restaurantRepository,
    IHoldService holdService)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;

    public virtual async Task<AvailabilityResponseDto> GetAvailabilityAsync(int restaurantId, DateTime bookingDate, int seats)
    {
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId)
            ?? throw new ArgumentException("Restaurant not found.");

        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(restaurant.Timezone); }
        catch { tz = TimeZoneInfo.Utc; }

        // Check if restaurant is paused
        bool isPaused = restaurant.BookingsPausedUntil.HasValue && restaurant.BookingsPausedUntil.Value > DateTime.UtcNow;

        // 1. Fetch all active bookings for this restaurant on this date (broad UTC range)
        IEnumerable<Booking> activeBookings = await _bookingRepository.GetActiveBookingsForDateAsync(restaurantId, bookingDate);

        // 2. Define the local operating hours for the requested date
        DateTime localDate = TimeZoneInfo.ConvertTimeFromUtc(bookingDate.ToUniversalTime(), tz).Date;

        if (!TryParseTime(restaurant.OpenTime, out int openHour, out int openMin))
        {
            openHour = 9; openMin = 0;
        }
        if (!TryParseTime(restaurant.CloseTime, out int closeHour, out int closeMin))
        {
            closeHour = 22; closeMin = 0;
        }

        DateTime localStart = localDate.AddHours(openHour).AddMinutes(openMin);
        DateTime localEnd = localDate.AddHours(closeHour).AddMinutes(closeMin);
        if (localEnd <= localStart)
        {
            localEnd = localEnd.AddDays(1);
        }

        // 3. Generate 15-minute slots
        var slots = new List<TimeSlotDto>();
        DateTime current = localStart;

        // Fetch all tables for the restaurant to check capacity
        var eligibleTables = restaurant.Sections
            .SelectMany(s => s.Tables)
            .Where(t => t.Seats >= seats)
            .ToList();

        // Optimize: Group bookings by table ID for faster lookup in the loop
        var bookingsByTable = activeBookings
            .GroupBy(b => b.TableId)
            .ToDictionary(g => g.Key, g => g.ToList());

        while (current < localEnd)
        {
            DateTime slotUtc = TimeZoneInfo.ConvertTimeToUtc(current, tz);
            var availableTableIds = new List<int>();

            if (!isPaused)
            {
                // A slot is available if AT LEAST ONE eligible table is free for the next hour
                DateTime slotEndUtc = slotUtc.AddHours(1);

                foreach (Table? table in eligibleTables)
                {
                    // Check bookings
                    if (bookingsByTable.TryGetValue(table.Id, out List<Booking>? tableBookings))
                    {
                        bool hasBookingConflict = tableBookings.Any(b =>
                            b.Date < slotEndUtc &&
                            (b.EndTime ?? b.Date.AddHours(1)) > slotUtc);

                        if (hasBookingConflict)
                        {
                            continue;
                        }
                    }

                    // Check holds
                    if (_holdService.IsTableHeld(table.Id, slotUtc))
                    {
                        continue;
                    }

                    availableTableIds.Add(table.Id);
                }
            }

            slots.Add(new TimeSlotDto
            {
                Time = current.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture),
                IsAvailable = availableTableIds.Count > 0,
                AvailableTableIds = availableTableIds,
                Category = GetCategory(current)
            });

            current = current.AddMinutes(15);
        }

        return new AvailabilityResponseDto
        {
            RestaurantId = restaurantId,
            Date = bookingDate,
            Slots = slots
        };
    }

    private static string GetCategory(DateTime time)
    {
        TimeSpan t = time.TimeOfDay;
        if (t >= new TimeSpan(11, 30, 0) && t < new TimeSpan(14, 30, 0))
        {
            return "Lunch";
        }
        if (t >= new TimeSpan(17, 30, 0) && t < new TimeSpan(21, 30, 0))
        {
            return "Dinner";
        }
        return "Off-Peak";
    }

    private static bool TryParseTime(string time, out int h, out int m)
    {
        h = 0; m = 0;
        if (string.IsNullOrEmpty(time))
        {
            return false;
        }
        string[] parts = time.Split(':');
        if (parts.Length < 2)
        {
            return false;
        }
        return int.TryParse(parts[0], out h) && int.TryParse(parts[1], out m);
    }
}
