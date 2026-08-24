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
            ?? throw new NotFoundException("Restaurant not found.") { Code = ErrorCodes.RestaurantNotFound };

        TimeZoneInfo tz = TimeZoneHelper.Resolve(restaurant.Timezone);

        IEnumerable<Booking> activeBookings = await _bookingRepository.GetActiveBookingsForDateAsync(restaurantId, bookingDate);

        // bookingDate arrives as YYYY-MM-DD, already the local date in the restaurant's
        // timezone. Converting it from UTC would shift midnight into the previous day for any
        // UTC-negative timezone.
        DateTime localDate = bookingDate.Date;
        int isoDay = IsoDay.Of(localDate);

        if (WalkInHelper.IsWalkInOnlyOn(restaurant, isoDay) || !ServiceWindowHelper.IsOpenOn(restaurant, isoDay))
        {
            return NoSlots(restaurantId, bookingDate);
        }

        (DateTime localStart, DateTime localEnd) = ServiceWindowHelper.LocalWindowFor(restaurant, localDate, isoDay);
        var reservations = new UnitReservations(restaurant, activeBookings);
        List<Table> eligibleTables = EligibleTables(restaurant, seats);
        List<TableGroup> eligibleGroups = EligibleGroups(restaurant, seats);

        var slots = new List<TimeSlotDto>();
        for (DateTime current = localStart; current < localEnd; current = current.AddMinutes(SlotInterval(restaurant)))
        {
            DateTime slotUtc = TimeZoneInfo.ConvertTimeToUtc(current, tz);

            // A pause closes the slots inside its window only; later sittings — including
            // later today — stay bookable.
            if (restaurant.IsPausedFor(slotUtc))
            {
                slots.Add(ClosedSlot(current));
                continue;
            }

            DateTime slotEndUtc = slotUtc.AddMinutes(restaurant.DefaultBookingDurationMinutes);
            List<int> availableTableIds = eligibleTables
                .Where(t => IsTableFree(t.Id, restaurant, reservations, slotUtc, slotEndUtc))
                .Select(t => t.Id)
                .ToList();
            List<int> availableGroupIds = eligibleGroups
                .Where(g => IsGroupFree(g, restaurant, reservations, slotUtc, slotEndUtc))
                .Select(g => g.Id)
                .ToList();

            slots.Add(new TimeSlotDto
            {
                Time = FormatSlotTime(current),
                IsAvailable = availableTableIds.Count > 0 || availableGroupIds.Count > 0,
                AvailableTableIds = availableTableIds,
                AvailableGroupIds = availableGroupIds,
                Category = GetCategory(current)
            });
        }

        return new AvailabilityResponseDto
        {
            RestaurantId = restaurantId,
            Date = bookingDate,
            Slots = slots
        };
    }

    private static AvailabilityResponseDto NoSlots(int restaurantId, DateTime bookingDate) => new()
    {
        RestaurantId = restaurantId,
        Date = bookingDate,
        Slots = new List<TimeSlotDto>()
    };

    private static TimeSlotDto ClosedSlot(DateTime local) => new()
    {
        Time = FormatSlotTime(local),
        IsAvailable = false,
        AvailableTableIds = new List<int>(),
        Category = GetCategory(local)
    };

    private static string FormatSlotTime(DateTime local)
        => local.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>
    /// A zero or negative stored interval would spin the slot loop forever. Validation keeps
    /// the column to 15/30/60, so this only ever catches a stale or hand-edited row.
    /// </summary>
    private static int SlotInterval(Restaurant restaurant)
        => restaurant.BookingSlotIntervalMinutes > 0 ? restaurant.BookingSlotIntervalMinutes : 30;

    private static List<Table> EligibleTables(Restaurant restaurant, int seats)
        => restaurant.Sections
            ?.SelectMany(s => s.Tables ?? new List<Table>())
            .Where(t => t != null && restaurant.CanSeat(t.Seats, seats))
            .ToList() ?? new List<Table>();

    /// <summary>
    /// Combinable groups are bookable units alongside the individual tables. Member tables
    /// stay in the eligible set — grouping a table does not stop it being booked on its own —
    /// so the mutual exclusion between a member and its group is resolved per slot by
    /// <see cref="UnitReservations"/> rather than by hiding the members here.
    /// </summary>
    /// <seealso>AvailabilityServiceTests.GetAvailabilityAsync_StillOffersGroupMembers_Individually</seealso>
    /// <seealso>AvailabilityServiceTests.GetAvailabilityAsync_RemovesGroupMember_WhenReservedByItsGroupBooking</seealso>
    private static List<TableGroup> EligibleGroups(Restaurant restaurant, int seats)
        => (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .Where(g => restaurant.CanSeat(g.CombinedSeats, seats))
            .ToList();

    private bool IsTableFree(int tableId, Restaurant restaurant, UnitReservations reservations, DateTime slotUtc, DateTime slotEndUtc)
        => !reservations.IsTableReserved(tableId, slotUtc, slotEndUtc)
            && !_holdService.IsTableHeld(tableId, slotUtc, durationMinutes: restaurant.DefaultBookingDurationMinutes);

    private bool IsGroupFree(TableGroup group, Restaurant restaurant, UnitReservations reservations, DateTime slotUtc, DateTime slotEndUtc)
        => !reservations.IsGroupReserved(group, slotUtc, slotEndUtc)
            && group.Members.All(m => !_holdService.IsTableHeld(m.TableId, slotUtc, durationMinutes: restaurant.DefaultBookingDurationMinutes));

    /// <summary>
    /// Indexes the day's bookings so each slot can be answered without rescanning them. A
    /// group booking stores <c>TableId = null</c>, so it is invisible to a table-keyed lookup;
    /// its members' table ids are resolved up front, or a table reserved by its group's
    /// booking would be advertised as available.
    /// </summary>
    private sealed class UnitReservations
    {
        private readonly int _defaultDurationMinutes;
        private readonly Dictionary<int, List<Booking>> _byTable;
        private readonly List<Booking> _groupBookings;
        private readonly List<(int TableId, Booking Booking)> _tablesHeldByGroupBookings;

        public UnitReservations(Restaurant restaurant, IEnumerable<Booking> activeBookings)
        {
            _defaultDurationMinutes = restaurant.DefaultBookingDurationMinutes;

            _byTable = activeBookings
                .Where(b => b.TableId.HasValue)
                .GroupBy(b => b.TableId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            _groupBookings = activeBookings.Where(b => b.TableGroupId.HasValue).ToList();

            Dictionary<int, HashSet<int>> memberTableIdsByGroup = (restaurant.Groups ?? Enumerable.Empty<TableGroup>())
                .ToDictionary(g => g.Id, g => g.Members.Select(m => m.TableId).ToHashSet());

            _tablesHeldByGroupBookings = _groupBookings
                .Where(b => memberTableIdsByGroup.ContainsKey(b.TableGroupId!.Value))
                .SelectMany(b => memberTableIdsByGroup[b.TableGroupId!.Value].Select(id => (id, b)))
                .ToList();
        }

        public bool IsTableReserved(int tableId, DateTime slotUtc, DateTime slotEndUtc)
        {
            if (_byTable.TryGetValue(tableId, out List<Booking>? tableBookings)
                && tableBookings.Any(b => Overlaps(b, slotUtc, slotEndUtc)))
            {
                return true;
            }

            return _tablesHeldByGroupBookings.Any(x => x.TableId == tableId && Overlaps(x.Booking, slotUtc, slotEndUtc));
        }

        public bool IsGroupReserved(TableGroup group, DateTime slotUtc, DateTime slotEndUtc)
            => _groupBookings.Any(b => b.TableGroupId == group.Id && Overlaps(b, slotUtc, slotEndUtc))
                || group.Members.Any(m => IsTableReserved(m.TableId, slotUtc, slotEndUtc));

        private bool Overlaps(Booking booking, DateTime slotUtc, DateTime slotEndUtc)
            => booking.Date < slotEndUtc
                && (booking.EndTime ?? booking.Date.AddMinutes(_defaultDurationMinutes)) > slotUtc;
    }

    // Windows are calibrated to North American restaurant data (Toast/Square/Yelp): lunch
    // peaks 12–1 PM with 2 PM starting the afternoon dead zone, dinner peaks at 6 PM (22% at
    // 5 PM, 37% at 6 PM) and drops sharply after 9 PM.
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
}
