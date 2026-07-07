using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public sealed class AvailabilityService(
    IBookingRepository bookingRepository,
    IRestaurantRepository restaurantRepository,
    IHoldService holdService) : IAvailabilityService
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;

    public async Task<AvailabilityResponseDto> GetAvailabilityAsync(int restaurantId, DateTime bookingDate, int seats)
    {
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId)
            ?? throw new NotFoundException("Restaurant not found.");

        TimeZoneInfo tz = TimeZoneHelper.Resolve(restaurant.Timezone);

        // Check if restaurant is paused
        bool isPaused = restaurant.IsPaused();

        // 1. Fetch all active bookings for this restaurant on this date (broad UTC range)
        IEnumerable<Booking> activeBookings = await _bookingRepository.GetActiveBookingsForDateAsync(restaurantId, bookingDate);

        // 2. Define the local operating hours for the requested date.
        // bookingDate is sent as YYYY-MM-DD from the frontend (already the local date in the
        // restaurant's timezone), so use it directly rather than converting from UTC — converting
        // from UTC would shift midnight into the previous day for any UTC-negative timezone.
        DateTime localDate = bookingDate.Date;

        int jsDay = (int)localDate.DayOfWeek; // 0=Sun…6=Sat
        int isoDay = jsDay == 0 ? 7 : jsDay;  // 1=Mon…7=Sun

        // Walk-in-only locations/days take no online bookings, so expose no slots.
        if (WalkInHelper.IsWalkInOnlyOn(restaurant, isoDay))
        {
            return new AvailabilityResponseDto
            {
                RestaurantId = restaurantId,
                Date = bookingDate,
                Slots = new List<TimeSlotDto>()
            };
        }

        // Check if this day of week is an open day
        if (!string.IsNullOrEmpty(restaurant.OpenDays))
        {
            var openDaysList = restaurant.OpenDays
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(d => ParseDayOfWeek(d.Trim()))
                .Where(d => d > 0)
                .ToHashSet();
            if (openDaysList.Count > 0 && !openDaysList.Contains(isoDay))
            {
                return new AvailabilityResponseDto
                {
                    RestaurantId = restaurantId,
                    Date = bookingDate,
                    Slots = new List<TimeSlotDto>()
                };
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

        DateTime localStart = localDate.AddHours(openHour).AddMinutes(openMin);
        DateTime localEnd = localDate.AddHours(closeHour).AddMinutes(closeMin);
        if (localEnd <= localStart)
        {
            localEnd = localEnd.AddDays(1);
        }

        // 3. Generate 30-minute slots
        var slots = new List<TimeSlotDto>();
        DateTime current = localStart;

        // Fetch all tables for the restaurant to check capacity
        var eligibleTables = restaurant.Sections
            ?.SelectMany(s => s.Tables ?? new List<Table>())
            .Where(t => t != null && t.Seats >= seats)
            .ToList() ?? new List<Table>();

        // Optimize: Group bookings by table ID for faster lookup in the loop
        var bookingsByTable = activeBookings
            .Where(b => b.TableId.HasValue)
            .GroupBy(b => b.TableId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        while (current < localEnd)
        {
            DateTime slotUtc = TimeZoneInfo.ConvertTimeToUtc(current, tz);
            var availableTableIds = new List<int>();

            if (!isPaused)
            {
                // A slot is available if AT LEAST ONE eligible table is free for the
                // restaurant's configured booking duration.
                DateTime slotEndUtc = slotUtc.AddMinutes(restaurant.DefaultBookingDurationMinutes);

                foreach (Table? table in eligibleTables)
                {
                    // Check bookings
                    if (bookingsByTable.TryGetValue(table.Id, out List<Booking>? tableBookings))
                    {
                        bool hasBookingConflict = tableBookings.Any(b =>
                            b.Date < slotEndUtc &&
                            (b.EndTime ?? b.Date.AddMinutes(restaurant.DefaultBookingDurationMinutes)) > slotUtc);

                        if (hasBookingConflict)
                        {
                            continue;
                        }
                    }

                    // Check holds
                    if (_holdService.IsTableHeld(table.Id, slotUtc, durationMinutes: restaurant.DefaultBookingDurationMinutes))
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

            current = current.AddMinutes(30);
        }

        return new AvailabilityResponseDto
        {
            RestaurantId = restaurantId,
            Date = bookingDate,
            Slots = slots
        };
    }

    // Category windows are calibrated to North American restaurant data (Toast/Square/Yelp):
    // Lunch peak is 12–1 PM; 2 PM begins the afternoon dead zone.
    // Dinner now peaks at 6 PM (22% at 5 PM, 37% at 6 PM, drops sharply after 9 PM).
    private static string GetCategory(DateTime time)
    {
        TimeSpan t = time.TimeOfDay;
        if (t >= new TimeSpan(11, 30, 0) && t < new TimeSpan(14, 0, 0))
        {
            return "Lunch";
        }
        if (t >= new TimeSpan(17, 0, 0) && t < new TimeSpan(21, 0, 0))
        {
            return "Dinner";
        }
        return "Off-Peak";
    }

    private static int ParseDayOfWeek(string day)
    {
        if (int.TryParse(day, out int dayNum) && dayNum >= 1 && dayNum <= 7)
            return dayNum;

        return day.ToLowerInvariant() switch
        {
            "mon" or "monday" => 1,
            "tue" or "tues" or "tuesday" => 2,
            "wed" or "wednesday" => 3,
            "thu" or "thurs" or "thursday" => 4,
            "fri" or "friday" => 5,
            "sat" or "saturday" => 6,
            "sun" or "sunday" => 7,
            _ => 0
        };
    }
}
