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

        // 3. Generate slots stepping by the restaurant's configured interval
        // (decoupled from DefaultBookingDurationMinutes — see Restaurant.BookingSlotIntervalMinutes).
        // Fall back to 30 min if the stored value is somehow degenerate (0/negative), which
        // would otherwise spin the while-loop below forever — server-side validation keeps
        // this to 15/30/60, but we defend against stale/corrupt rows regardless.
        int slotIntervalMinutes = restaurant.BookingSlotIntervalMinutes > 0
            ? restaurant.BookingSlotIntervalMinutes
            : 30;
        var slots = new List<TimeSlotDto>();
        DateTime current = localStart;

        // Fetch all tables for the restaurant to check capacity. The lower bound keeps a
        // party off a too-small table; the optional upper bound (Restaurant.MaxTableOversizeSeats)
        // keeps a small party off a much larger table a restaurant would rather hold for a
        // bigger group. Mirrored in BookingService and TableAutoAssigner so the customer-facing
        // options always match what the server will accept.
        var eligibleTables = restaurant.Sections
            ?.SelectMany(s => s.Tables ?? new List<Table>())
            .Where(t => t != null && t.Seats >= seats
                && (restaurant.MaxTableOversizeSeats == null
                    || t.Seats - seats <= restaurant.MaxTableOversizeSeats.Value))
            .ToList() ?? new List<Table>();

        // Combinable-table groups (#272): a group is bookable when its CombinedSeats fits the party
        // and the same optional oversize cap is satisfied. Per slot, a group is free iff ALL of its
        // members are free. Member tables stay in AvailableTableIds — tables 8 and 9 still seat 4
        // each on their own (#242) — and the member/group mutual exclusion is enforced per slot by
        // IsTableReserved/IsGroupReserved rather than by hiding the members.
        var eligibleGroups = (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .Where(g => g.CombinedSeats >= seats
                && (restaurant.MaxTableOversizeSeats == null
                    || g.CombinedSeats - seats <= restaurant.MaxTableOversizeSeats.Value))
            .ToList();

        // Optimize: index single-table bookings by table id and group bookings by group id. A group
        // booking stores TableId = null, so it would be invisible to a table-only lookup — index it by
        // its group id and resolve member table ids from the restaurant's loaded groups so the per-slot
        // loops can detect it (otherwise a group/member reserved by a group booking would be advertised
        // as available).
        var bookingsByTable = activeBookings
            .Where(b => b.TableId.HasValue)
            .GroupBy(b => b.TableId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var groupBookings = activeBookings.Where(b => b.TableGroupId.HasValue).ToList();

        // groupId → set of member table ids, from the restaurant's loaded combinable groups.
        var groupMemberTableIds = (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .ToDictionary(g => g.Id, g => g.Members.Select(m => m.TableId).ToHashSet());

        // All physical table ids reserved by any group booking (the booked group's members). A standalone
        // table in this set is effectively taken for the relevant slots even though no row sets its TableId.
        var groupBookedTableIdsByGroup = groupBookings
            .Where(b => b.TableGroupId.HasValue && groupMemberTableIds.ContainsKey(b.TableGroupId!.Value))
            .SelectMany(b => groupMemberTableIds[b.TableGroupId!.Value].Select(id => (id, b)))
            .ToList();

        bool Overlaps(Booking b, DateTime slotUtc, DateTime slotEndUtc) =>
            b.Date < slotEndUtc &&
            (b.EndTime ?? b.Date.AddMinutes(restaurant.DefaultBookingDurationMinutes)) > slotUtc;

        bool IsTableReserved(int tableId, DateTime slotUtc, DateTime slotEndUtc)
        {
            if (bookingsByTable.TryGetValue(tableId, out List<Booking>? tableBookings)
                && tableBookings.Any(b => Overlaps(b, slotUtc, slotEndUtc)))
            {
                return true;
            }

            // Reserved by a group booking whose group counts this table as a member.
            return groupBookedTableIdsByGroup.Any(x => x.id == tableId && Overlaps(x.b, slotUtc, slotEndUtc));
        }

        bool IsGroupReserved(TableGroup group, DateTime slotUtc, DateTime slotEndUtc)
        {
            // The group itself already booked for this slot.
            if (groupBookings.Any(b => b.TableGroupId == group.Id && Overlaps(b, slotUtc, slotEndUtc)))
            {
                return true;
            }

            // Any member reserved individually, or by a sibling group booking, makes the group unavailable.
            foreach (TableGroupMembership member in group.Members)
            {
                if (IsTableReserved(member.TableId, slotUtc, slotEndUtc))
                {
                    return true;
                }
            }

            return false;
        }

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
                    // Group-aware booking check (catches single-table + group bookings reserving it).
                    if (IsTableReserved(table.Id, slotUtc, slotEndUtc))
                    {
                        continue;
                    }

                    // Check holds
                    if (_holdService.IsTableHeld(table.Id, slotUtc, durationMinutes: restaurant.DefaultBookingDurationMinutes))
                    {
                        continue;
                    }

                    availableTableIds.Add(table.Id);
                }

                // Combinable groups: a group is free iff it isn't already booked and ALL members are free.
                var availableGroupIds = new List<int>();
                foreach (TableGroup group in eligibleGroups)
                {
                    if (IsGroupReserved(group, slotUtc, slotEndUtc))
                    {
                        continue;
                    }

                    bool allMembersFreeOfHolds = true;
                    foreach (TableGroupMembership member in group.Members)
                    {
                        if (_holdService.IsTableHeld(member.TableId, slotUtc, durationMinutes: restaurant.DefaultBookingDurationMinutes))
                        {
                            allMembersFreeOfHolds = false;
                            break;
                        }
                    }

                    if (allMembersFreeOfHolds)
                    {
                        availableGroupIds.Add(group.Id);
                    }
                }

                slots.Add(new TimeSlotDto
                {
                    Time = current.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture),
                    IsAvailable = availableTableIds.Count > 0 || availableGroupIds.Count > 0,
                    AvailableTableIds = availableTableIds,
                    AvailableGroupIds = availableGroupIds,
                    Category = GetCategory(current)
                });
            }
            else
            {
                slots.Add(new TimeSlotDto
                {
                    Time = current.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture),
                    IsAvailable = false,
                    AvailableTableIds = availableTableIds,
                    Category = GetCategory(current)
                });
            }

            current = current.AddMinutes(slotIntervalMinutes);
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
