using System.Security.Cryptography;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The walk-in queue: guests join at the door or from the public site, staff call and seat them,
/// and seating turns the entry into an ordinary <see cref="Booking"/> so the floor, availability
/// and reporting all see the table as taken.
/// </summary>
public class WaitlistService(
    IWaitlistRepository waitlistRepository,
    IRestaurantRepository restaurantRepository,
    IBookingRepository bookingRepository,
    TableAutoAssigner autoAssigner,
    ISystemClock clock,
    IWaitlistReadyNotifier? readyNotifier = null,
    INotificationQueue? notificationQueue = null,
    ICurrentUserService? currentUser = null,
    IAuditScope? audit = null)
{
    /// <summary>An entry still queued this long after joining belongs to a service that has ended.</summary>
    public static readonly TimeSpan StaleAfter = TimeSpan.FromHours(12);

    /// <summary>Entries hold a guest's name and email, so they are deleted this long after joining.</summary>
    public static readonly TimeSpan RetainFor = TimeSpan.FromDays(7);

    private const string RefAlphabet = "abcdefghijkmnpqrstuvwxyz23456789";

    private readonly IWaitlistRepository _waitlist = waitlistRepository;
    private readonly IRestaurantRepository _restaurants = restaurantRepository;
    private readonly IBookingRepository _bookings = bookingRepository;
    private readonly TableAutoAssigner _autoAssigner = autoAssigner;
    private readonly ISystemClock _clock = clock;
    private readonly IWaitlistReadyNotifier? _readyNotifier = readyNotifier;
    private readonly INotificationQueue? _notificationQueue = notificationQueue;
    private readonly ICurrentUserService _currentUser = currentUser ?? NullCurrentUserService.Instance;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    /// <summary>
    /// True while the public site offers the queue: the location is walk-in only and open at
    /// <paramref name="nowUtc"/>. Staff can add a party at any time.
    /// </summary>
    /// <seealso>WaitlistServiceTests.JoinAsync_Rejects_OnADayThatTakesBookings</seealso>
    /// <seealso>WaitlistServiceTests.JoinAsync_Rejects_OutsideOpeningHours</seealso>
    /// <seealso>WaitlistServiceTests.JoinAsync_Accepts_DuringAWalkInSitting</seealso>
    public static bool AcceptsGuestsAt(Restaurant restaurant, DateTime nowUtc)
        => restaurant.IsWalkInOnlyAt(nowUtc) && restaurant.IsOpenAt(nowUtc);

    public async Task<WaitlistStatusDto> JoinAsync(int restaurantId, JoinWaitlistRequest req)
    {
        Restaurant restaurant = await LoadRestaurantAsync(restaurantId);
        DateTime now = _clock.UtcNow;

        if (!restaurant.IsWalkInOnlyAt(now))
        {
            throw new ConflictException("This location isn't running a walk-in waitlist today.") { Code = ErrorCodes.WaitlistNotWalkInNow };
        }

        if (!restaurant.IsOpenAt(now))
        {
            throw new ConflictException("This location is closed right now.") { Code = ErrorCodes.WaitlistClosedNow };
        }

        WaitlistEntry entry = await AddEntryAsync(restaurant, req, now);
        return await BuildStatusAsync(entry, restaurant);
    }

    public async Task<WaitlistEntryDto> AddByStaffAsync(int restaurantId, JoinWaitlistRequest req)
    {
        Restaurant restaurant = await LoadRestaurantAsync(restaurantId);
        WaitlistEntry entry = await AddEntryAsync(restaurant, req, _clock.UtcNow);

        Describe(AuditActions.WaitlistAdd, entry, $"Added ticket #{entry.Number} for {entry.Seats} guests to the waitlist");
        WaitlistBoardDto board = await GetBoardAsync(restaurantId);
        return board.Entries.First(e => e.Id == entry.Id);
    }

    public async Task<WaitlistStatusDto?> GetStatusAsync(string entryRef)
    {
        WaitlistEntry? entry = await _waitlist.GetByRefAsync(entryRef);
        if (entry == null)
        {
            return null;
        }

        Restaurant? restaurant = await _restaurants.GetByIdAsync(entry.RestaurantId);
        return restaurant == null ? null : await BuildStatusAsync(entry, restaurant);
    }

    /// <summary>The guest withdrawing. Idempotent once the entry has left the queue.</summary>
    public async Task<bool> LeaveAsync(string entryRef)
    {
        WaitlistEntry? entry = await _waitlist.GetByRefAsync(entryRef);
        if (entry == null)
        {
            return false;
        }

        if (entry.IsActive)
        {
            Close(entry, WaitlistStatus.Left);
            await _waitlist.SaveChangesAsync();
        }
        return true;
    }

    public async Task<WaitlistBoardDto> GetBoardAsync(int restaurantId)
    {
        Restaurant restaurant = await LoadRestaurantAsync(restaurantId);
        DateTime now = _clock.UtcNow;
        List<WaitlistEntry> queue = Order(await _waitlist.GetActiveForRestaurantAsync(restaurantId));
        IReadOnlyList<DateTime?> seatAt = await EstimateAsync(restaurant, queue, now);

        var canSeatBySize = new Dictionary<int, bool>();
        foreach (int seats in queue.Select(e => e.Seats).Distinct())
        {
            canSeatBySize[seats] = (await _autoAssigner.BuildCandidatesAsync(restaurant, seats, now)).Count > 0;
        }

        var entries = new List<WaitlistEntryDto>(queue.Count);
        for (int i = 0; i < queue.Count; i++)
        {
            WaitlistEntry e = queue[i];
            entries.Add(new WaitlistEntryDto
            {
                Id = e.Id,
                Number = e.Number,
                Name = e.Name,
                Email = e.Email,
                Seats = e.Seats,
                Status = StatusName(e.Status),
                JoinedAt = e.CreatedAt,
                NotifiedAt = e.NotifiedAt,
                PartiesAhead = i,
                EstimatedWaitMinutes = WaitEstimator.MinutesUntil(seatAt[i], now),
                CanSeatNow = canSeatBySize[e.Seats],
            });
        }

        return new WaitlistBoardDto
        {
            RestaurantId = restaurantId,
            AcceptingGuests = AcceptsGuestsAt(restaurant, now),
            Entries = BookingGuestVisibility.Apply(entries, _currentUser),
        };
    }

    /// <summary>Calls the party up. Calling again re-sends the message.</summary>
    public async Task NotifyAsync(int entryId)
    {
        WaitlistEntry entry = await LoadActiveEntryAsync(entryId);
        entry.Status = WaitlistStatus.Notified;
        entry.NotifiedAt = _clock.UtcNow;
        await _waitlist.SaveChangesAsync();

        if (_readyNotifier != null)
        {
            await _readyNotifier.NotifyAsync(entry, entry.Restaurant);
        }

        Describe(AuditActions.WaitlistNotify, entry, $"Called ticket #{entry.Number}");
    }

    /// <summary>
    /// Seats the party at a unit free for a whole sitting from now, recording it as a booking.
    /// </summary>
    /// <seealso>WaitlistServiceTests.SeatAsync_CreatesABookingOnTheSmallestFreeTable</seealso>
    /// <seealso>WaitlistServiceTests.SeatAsync_Rejects_WhenNoTableIsFree</seealso>
    /// <seealso>WaitlistServiceTests.SeatAsync_Rejects_ATableThatIsNotFree</seealso>
    public async Task<SeatWaitlistEntryResponse> SeatAsync(int entryId, SeatWaitlistEntryRequest req)
    {
        WaitlistEntry entry = await LoadActiveEntryAsync(entryId);
        Restaurant restaurant = await LoadRestaurantAsync(entry.RestaurantId);
        DateTime now = _clock.UtcNow;

        IReadOnlyList<TableCandidate> free = await _autoAssigner.BuildCandidatesAsync(restaurant, entry.Seats, now);
        TableCandidate unit = PickUnit(free, req)
            ?? throw new ConflictException("No free table can seat this party right now.") { Code = ErrorCodes.WaitlistNoTableFree };

        var booking = new Booking
        {
            RestaurantId = restaurant.Id,
            SectionId = unit.SectionId,
            TableId = unit.IsGroup ? null : unit.TableId,
            TableGroupId = unit.TableGroupId,
            Date = now,
            EndTime = now.AddMinutes(restaurant.DefaultBookingDurationMinutes),
            CustomerName = entry.Name,
            CustomerEmail = entry.Email,
            Seats = entry.Seats,
            BookingRef = BookingRefFactory.GenerateFor(restaurant),
        };
        await _bookings.AddAsync(booking);

        Close(entry, WaitlistStatus.Seated);
        entry.BookingId = booking.Id;
        await _waitlist.SaveChangesAsync();

        _notificationQueue?.EnqueueBookingCreated(booking, restaurant.Name);
        Describe(AuditActions.WaitlistSeat, entry, $"Seated ticket #{entry.Number} as booking {booking.BookingRef}");

        return new SeatWaitlistEntryResponse
        {
            Entry = BookingGuestVisibility.Apply(ToClosedDto(entry), _currentUser),
            BookingId = booking.Id,
            BookingRef = booking.BookingRef,
        };
    }

    public async Task RemoveAsync(int entryId)
    {
        WaitlistEntry entry = await LoadActiveEntryAsync(entryId);
        Close(entry, WaitlistStatus.Left);
        await _waitlist.SaveChangesAsync();

        Describe(AuditActions.WaitlistRemove, entry, $"Removed ticket #{entry.Number} from the waitlist");
    }

    /// <summary>Expires entries left over from an ended service and deletes old ones.</summary>
    /// <seealso>WaitlistServiceTests.SweepAsync_ExpiresEntriesPastStaleAfter_AndDeletesPastRetainFor</seealso>
    public virtual async Task SweepAsync()
    {
        DateTime now = _clock.UtcNow;
        await _waitlist.ExpireActiveCreatedBeforeAsync(now - StaleAfter, now);
        await _waitlist.DeleteCreatedBeforeAsync(now - RetainFor);
    }

    private async Task<WaitlistEntry> AddEntryAsync(Restaurant restaurant, JoinWaitlistRequest req, DateTime now)
    {
        string name = (req.Name ?? string.Empty).Trim();
        if (name.Length == 0)
        {
            throw new ValidationException("A name is required to join the waitlist.") { Code = ErrorCodes.WaitlistNameRequired };
        }

        string? email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim().ToLowerInvariant();
        if (email != null && !EmailValidator.IsValid(email))
        {
            throw new ValidationException("That email address doesn't look right.") { Code = ErrorCodes.WaitlistEmailInvalid };
        }

        if (WaitEstimator.EstimateSeatingTimes(restaurant, new[] { req.Seats }, new Dictionary<int, DateTime>(), now)[0] is null)
        {
            throw new ConflictException($"No table here can seat a party of {req.Seats}.")
            { Code = ErrorCodes.WaitlistPartyTooLarge, Args = new Dictionary<string, object> { ["seats"] = req.Seats } };
        }

        (DateTime dayStart, _) = TimeZoneHelper.GetUtcRangeForLocalDay(now, restaurant.Timezone);
        var entry = new WaitlistEntry
        {
            RestaurantId = restaurant.Id,
            Restaurant = restaurant,
            Ref = RandomNumberGenerator.GetString(RefAlphabet, WaitlistFields.RefLength),
            Number = await _waitlist.CountCreatedSinceAsync(restaurant.Id, dayStart) + 1,
            Name = name,
            Seats = req.Seats,
            Email = email,
            Locale = SupportedLocales.IsSupported(req.Locale) ? req.Locale! : "en",
            Status = WaitlistStatus.Waiting,
            CreatedAt = now,
        };
        return await _waitlist.AddAsync(entry);
    }

    private async Task<WaitlistStatusDto> BuildStatusAsync(WaitlistEntry entry, Restaurant restaurant)
    {
        var dto = new WaitlistStatusDto
        {
            Ref = entry.Ref,
            Number = entry.Number,
            RestaurantId = restaurant.Id,
            RestaurantName = restaurant.Name,
            Name = entry.Name,
            Seats = entry.Seats,
            Status = StatusName(entry.Status),
            JoinedAt = entry.CreatedAt,
            NotifiedAt = entry.NotifiedAt,
        };

        if (!entry.IsActive)
        {
            return dto;
        }

        DateTime now = _clock.UtcNow;
        List<WaitlistEntry> queue = Order(await _waitlist.GetActiveForRestaurantAsync(restaurant.Id));
        int index = queue.FindIndex(e => e.Id == entry.Id);
        IReadOnlyList<DateTime?> seatAt = await EstimateAsync(restaurant, queue, now);

        dto.PartiesAhead = index;
        dto.EstimatedWaitMinutes = index < 0 ? null : WaitEstimator.MinutesUntil(seatAt[index], now);
        return dto;
    }

    private async Task<IReadOnlyList<DateTime?>> EstimateAsync(Restaurant restaurant, List<WaitlistEntry> queue, DateTime now)
    {
        List<Booking> seated = await _bookings.GetInProgressForRestaurantAsync(restaurant.Id, now, restaurant.DefaultBookingDurationMinutes);
        return WaitEstimator.EstimateSeatingTimes(
            restaurant,
            queue.Select(e => e.Seats).ToList(),
            WaitEstimator.TableFreeTimes(restaurant, seated),
            now);
    }

    /// <summary>
    /// Called parties first, since they are about to take a table, then everyone else in the
    /// order they joined.
    /// </summary>
    /// <seealso>WaitlistServiceTests.GetBoardAsync_PutsCalledPartiesAheadOfTheQueue</seealso>
    private static List<WaitlistEntry> Order(IEnumerable<WaitlistEntry> active)
        => active
            .OrderBy(e => e.Status == WaitlistStatus.Notified ? 0 : 1)
            .ThenBy(e => e.CreatedAt)
            .ThenBy(e => e.Id)
            .ToList();

    private static TableCandidate? PickUnit(IReadOnlyList<TableCandidate> free, SeatWaitlistEntryRequest req)
    {
        if (req.TableGroupId is { } groupId)
        {
            return free.FirstOrDefault(c => c.IsGroup && c.TableGroupId == groupId);
        }

        if (req.TableId is { } tableId)
        {
            return free.FirstOrDefault(c => !c.IsGroup && c.TableId == tableId);
        }

        return free.Count > 0 ? free[0] : null;
    }

    private async Task<Restaurant> LoadRestaurantAsync(int restaurantId)
        => await _restaurants.GetByIdAsync(restaurantId)
            ?? throw new NotFoundException("Restaurant not found.") { Code = ErrorCodes.RestaurantNotFound };

    private async Task<WaitlistEntry> LoadActiveEntryAsync(int entryId)
    {
        WaitlistEntry entry = await _waitlist.GetByIdAsync(entryId)
            ?? throw new NotFoundException("Waitlist entry not found.") { Code = ErrorCodes.WaitlistNotFound };

        if (!entry.IsActive)
        {
            throw new ConflictException("This party has already left the waitlist.") { Code = ErrorCodes.WaitlistNotActive };
        }
        return entry;
    }

    private void Close(WaitlistEntry entry, WaitlistStatus status)
    {
        entry.Status = status;
        entry.ClosedAt = _clock.UtcNow;
    }

    private static WaitlistEntryDto ToClosedDto(WaitlistEntry e) => new()
    {
        Id = e.Id,
        Number = e.Number,
        Name = e.Name,
        Email = e.Email,
        Seats = e.Seats,
        Status = StatusName(e.Status),
        JoinedAt = e.CreatedAt,
        NotifiedAt = e.NotifiedAt,
    };

    private static string StatusName(WaitlistStatus status) => status.ToString().ToLowerInvariant();

    /// <summary>
    /// Entries are named by ticket number, never by the guest: the audit trail outlives the
    /// seven-day retention that deletes the name and email.
    /// </summary>
    private void Describe(string action, WaitlistEntry entry, string summary)
        => _audit.Describe(action, AuditTargets.WaitlistEntry, AuditTargets.IdOf(entry.Id),
            $"#{entry.Number}", entry.RestaurantId, summary);
}
