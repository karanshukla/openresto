using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The host stand's one read per poll: every table and group with its derived state, tonight's
/// bookings and the waitlist board. Writes go through the existing booking-status and waitlist
/// endpoints, so nothing here changes state.
/// </summary>
public class TonightService(
    IRestaurantRepository restaurantRepository,
    IBookingRepository bookingRepository,
    AdminService adminService,
    WaitlistService waitlistService,
    TableAutoAssigner autoAssigner,
    ISystemClock clock)
{
    /// <summary>
    /// How far back a sitting can have started and still be on the floor, so a party seated before
    /// midnight stays on its tile after the local day turns over.
    /// </summary>
    public static readonly TimeSpan FloorLookback = TimeSpan.FromHours(12);

    private readonly IRestaurantRepository _restaurants = restaurantRepository;
    private readonly IBookingRepository _bookings = bookingRepository;
    private readonly AdminService _admin = adminService;
    private readonly WaitlistService _waitlist = waitlistService;
    private readonly TableAutoAssigner _autoAssigner = autoAssigner;
    private readonly ISystemClock _clock = clock;

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>TonightServiceTests.GetAsync_DerivesEachTilesState</seealso>
    /// <seealso>TonightServiceTests.GetAsync_MarksAMemberTableSeated_WhenItsGroupIsSeated</seealso>
    /// <seealso>TonightServiceTests.GetAsync_MarksAGroupSeated_WhenAMemberTableIsSeated</seealso>
    /// <seealso>TonightServiceTests.GetAsync_KeepsASittingFromBeforeMidnightOnTheFloor</seealso>
    /// <seealso>TonightServiceTests.GetAsync_RedactsGuests_ForAKeyWithoutGuestsRead</seealso>
    public async Task<TonightDto> GetAsync(int restaurantId)
    {
        Restaurant restaurant = await _restaurants.GetByIdAsync(restaurantId)
            ?? throw new NotFoundException("Restaurant not found.") { Code = ErrorCodes.RestaurantNotFound };
        DateTime now = _clock.UtcNow;

        (DateTime dayStart, DateTime dayEnd) = TimeZoneHelper.GetUtcRangeForLocalDay(now, restaurant.Timezone);
        DateTime from = dayStart < now - FloorLookback ? dayStart : now - FloorLookback;
        List<Booking> loaded = await _bookings.GetForRestaurantInUtcRangeAsync(restaurant.Id, from, dayEnd);
        List<Booking> tonight = loaded
            .Where(b => !b.IsCancelled && (b.Date >= dayStart || IsOnTheFloor(b)))
            .OrderBy(b => b.Date)
            .ToList();

        int defaultMinutes = restaurant.DefaultBookingDurationMinutes;
        Dictionary<int, List<int>> groupsByTable = restaurant.Groups
            .SelectMany(g => g.Members.Select(m => (m.TableId, GroupId: g.Id)))
            .GroupBy(x => x.TableId)
            .ToDictionary(x => x.Key, x => x.Select(y => y.GroupId).ToList());

        var sections = restaurant.Sections
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .Select(s => new FloorSectionDto
            {
                Id = s.Id,
                Name = s.Name,
                Units = s.Tables
                    .OrderBy(t => t.Id)
                    .Select(t =>
                    {
                        List<int> groupIds = groupsByTable.GetValueOrDefault(t.Id) ?? [];
                        IEnumerable<Booking> on = tonight.Where(b =>
                            b.TableId == t.Id || (b.TableGroupId is { } g && groupIds.Contains(g)));
                        return ToUnit("table", t.Id, t.Name ?? string.Empty, t.Seats, t.WalkInOnly, [],
                            FloorState.Read(on, now, defaultMinutes));
                    })
                    .ToList(),
            })
            .ToList();

        var groups = restaurant.Groups
            .OrderBy(g => g.Id)
            .Select(g =>
            {
                List<int> members = g.Members.Select(m => m.TableId).ToList();
                IEnumerable<Booking> on = tonight.Where(b =>
                    b.TableGroupId == g.Id || (b.TableId is { } t && members.Contains(t)));
                return ToUnit("group", g.Id, BookingMapper.GroupLabel(g), g.CombinedSeats, g.HasWalkInOnlyMember(), members,
                    FloorState.Read(on, now, defaultMinutes));
            })
            .ToList();

        WaitlistBoardDto waitlist = await _waitlist.GetBoardAsync(restaurant.Id);

        return new TonightDto
        {
            RestaurantId = restaurant.Id,
            RestaurantName = restaurant.Name,
            Timezone = restaurant.Timezone,
            Now = now,
            BookedSoonMinutes = (int)FloorState.BookedSoonWindow.TotalMinutes,
            Sections = sections,
            Groups = groups,
            Bookings = _admin.ToAdminDtos(tonight),
            Waitlist = waitlist,
            SeatableNow = await SeatableNowAsync(restaurant, waitlist, now),
        };
    }

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>TonightServiceTests.GetAsync_OffersAWaitingPartyOnlyTheUnitsFreeForAWholeSitting</seealso>
    private async Task<List<SeatableNowDto>> SeatableNowAsync(Restaurant restaurant, WaitlistBoardDto waitlist, DateTime now)
    {
        var result = new List<SeatableNowDto>();
        foreach (int seats in waitlist.Entries.Select(e => e.Seats).Distinct().Order())
        {
            IReadOnlyList<TableCandidate> free = await _autoAssigner.BuildCandidatesAsync(restaurant, seats, now, includeWalkInOnly: true);
            result.Add(new SeatableNowDto
            {
                Seats = seats,
                TableIds = free.Where(c => !c.IsGroup).Select(c => c.TableId).ToList(),
                TableGroupIds = free.Where(c => c.IsGroup && c.TableGroupId.HasValue).Select(c => c.TableGroupId!.Value).ToList(),
            });
        }
        return result;
    }

    private static bool IsOnTheFloor(Booking b) => b.Status is BookingStatus.Seated or BookingStatus.Arrived;

    private static FloorUnitDto ToUnit(string kind, int id, string name, int seats, bool walkInOnly, List<int> members, FloorReading reading) => new()
    {
        Kind = kind,
        Id = id,
        Name = name,
        Seats = seats,
        WalkInOnly = walkInOnly,
        MemberTableIds = members,
        State = StateName(reading.State),
        CurrentBookingId = reading.Current?.Id,
        CurrentEndsAt = reading.CurrentEndsAt,
        NextBookingId = reading.Next?.Id,
        NextBookingAt = reading.Next?.Date,
    };

    private static string StateName(FloorTileState state) => state switch
    {
        FloorTileState.BookedSoon => "bookedSoon",
        FloorTileState.Seated => "seated",
        FloorTileState.Overdue => "overdue",
        _ => "free",
    };
}
