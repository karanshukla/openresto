using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BookingService(
    IBookingRepository bookingRepository,
    ITableRepository tableRepository,
    ISectionRepository sectionRepository,
    IRestaurantRepository restaurantRepository,
    IHoldService holdService,
    BookingMapper mapper,
    TableAutoAssigner autoAssigner,
    ITableGroupRepository tableGroupRepository,
    IBookingConfirmationService? confirmationService = null,
    INotificationQueue? notificationQueue = null,
    ICurrentUserService? currentUser = null)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;
    private readonly BookingMapper _mapper = mapper;
    private readonly TableAutoAssigner _autoAssigner = autoAssigner;
    private readonly ITableGroupRepository _tableGroupRepository = tableGroupRepository;
    private readonly IBookingConfirmationService? _confirmationService = confirmationService;
    private readonly INotificationQueue? _notificationQueue = notificationQueue;
    private readonly ICurrentUserService _currentUser = currentUser ?? NullCurrentUserService.Instance;

    public virtual async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        Restaurant restaurant = await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId)
            ?? throw new NotFoundException("Restaurant not found.") { Code = ErrorCodes.RestaurantNotFound };

        // An Unspecified date is the restaurant's local time; every check below runs on UTC.
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(bookingDto.Date, restaurant.Timezone);

        RejectIfClosedToOnlineBookings(restaurant, bookingDate);
        RejectIfPartySizeOutOfRange(bookingDto.Seats);

        if (bookingDto.TableGroupId.HasValue && bookingDto.TableId is null)
        {
            return await CreateGroupBookingAsync(bookingDto, restaurant, bookingDate);
        }

        if (bookingDto.TableId is null || bookingDto.SectionId is null)
        {
            bool ambiguousSelection = bookingDto.TableId is null ^ bookingDto.SectionId is null;
            if (ambiguousSelection)
            {
                throw new ValidationException("Specify both TableId and SectionId, or neither for auto-assign.") { Code = ErrorCodes.BookingAmbiguousTableSelection };
            }

            await ResolveAutoAssignAsync(bookingDto, restaurant, bookingDate);
        }

        // Auto-assign may have landed on a group rather than a table.
        if (bookingDto.TableGroupId.HasValue)
        {
            return await CreateGroupBookingAsync(bookingDto, restaurant, bookingDate);
        }

        int tableId = bookingDto.TableId!.Value;
        int sectionId = bookingDto.SectionId!.Value;

        bool alreadyBooked = await _bookingRepository.IsUnitBookedOnDateAsync(
            tableId, tableGroupId: null, bookingDate, restaurant.DefaultBookingDurationMinutes);
        if (alreadyBooked)
        {
            throw new ConflictException("This table is already booked for that time.") { Code = ErrorCodes.BookingTableConflict };
        }

        bool heldByOther = _holdService.IsTableHeld(
            tableId, bookingDate, excludeHoldId: bookingDto.HoldId,
            durationMinutes: restaurant.DefaultBookingDurationMinutes);
        if (heldByOther)
        {
            throw new ConflictException("This table is currently being held by another user. Please try again shortly.") { Code = ErrorCodes.BookingTableHeld };
        }

        Table? table = await _tableRepository.GetByIdAsync(tableId);
        RejectIfTableCannotSeat(table, restaurant, bookingDto.Seats);

        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate;
        booking.BookingRef = BookingRefFactory.GenerateFor(restaurant);
        booking.EndTime = bookingDate.AddMinutes(restaurant.DefaultBookingDurationMinutes);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(sectionId))!;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        await AnnounceBookingAsync(newBooking, restaurant);

        return _mapper.ToDtoWithGroup(newBooking);
    }

    /// <summary>
    /// The three ways a location refuses an online booking for a given sitting. Admin-recorded
    /// bookings go through <c>AdminService.CreateBookingAsync</c> and are deliberately exempt
    /// from all of them, so staff can still log a walk-in during a pause.
    /// </summary>
    /// <seealso>BookingServiceTests.CreateBookingAsync_RejectsBooking_InsideThePauseWindow</seealso>
    /// <seealso>BookingServiceTests.CreateBookingAsync_AllowsBooking_AfterThePauseWindow</seealso>
    private static void RejectIfClosedToOnlineBookings(Restaurant restaurant, DateTime bookingDate)
    {
        if (bookingDate < DateTime.UtcNow.AddMinutes(-Booking.CancellationGraceMinutes))
        {
            throw new ConflictException("Cannot create a booking in the past.") { Code = ErrorCodes.BookingPastDate };
        }

        if (restaurant.IsPausedFor(bookingDate))
        {
            PauseHelper.Rejection pause = PauseHelper.RejectionFor(restaurant);
            throw new ConflictException(pause.Message) { Code = pause.Code, Args = pause.Args };
        }

        if (restaurant.IsWalkInOnlyAt(bookingDate))
        {
            throw new ConflictException(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day. Please choose another day or just come in.")
            { Code = restaurant.WalkInOnly ? ErrorCodes.BookingWalkInOnly : ErrorCodes.BookingWalkInOnlyToday };
        }
    }

    /// <summary>
    /// Defence in depth behind the DTO's <c>[Range]</c>: without it a party of zero clears the
    /// upper-bound capacity check on any table and persists.
    /// </summary>
    private static void RejectIfPartySizeOutOfRange(int seats)
    {
        if (seats < BookingLimits.MinSeats || seats > BookingLimits.MaxSeats)
        {
            throw new ValidationException(
                $"Party size must be between {BookingLimits.MinSeats} and {BookingLimits.MaxSeats}.")
            { Code = ErrorCodes.BookingPartySizeOutOfRange, Args = new Dictionary<string, object> { ["min"] = BookingLimits.MinSeats, ["max"] = BookingLimits.MaxSeats } };
        }
    }

    private static void RejectIfTableCannotSeat(Table? table, Restaurant? restaurant, int seats)
    {
        if (table == null)
        {
            return;
        }

        if (seats > table.Seats)
        {
            throw new ConflictException($"This table only has {table.Seats} seats, but {seats} guests were requested.") { Code = ErrorCodes.TableSeatsExceeded, Args = new Dictionary<string, object> { ["seats"] = table.Seats, ["requested"] = seats } };
        }

        if (restaurant?.ExceedsOversizeCap(table.Seats, seats) == true)
        {
            throw new ConflictException(
                $"This table has {table.Seats} seats, which is too large for a party of {seats}.")
            { Code = ErrorCodes.TableOversizeCap, Args = new Dictionary<string, object> { ["seats"] = table.Seats, ["partySize"] = seats } };
        }
    }

    /// <summary>Best-effort side effects: neither the push nor the email may fail the booking.</summary>
    private async Task AnnounceBookingAsync(Booking booking, Restaurant restaurant)
    {
        if (_notificationQueue != null)
        {
            _notificationQueue.EnqueueBookingCreated(booking, restaurant.Name);
            _notificationQueue.EnqueueCapacityCheck(restaurant.Id, restaurant.Name, booking.Date);
        }

        if (_confirmationService != null)
        {
            await _confirmationService.SendConfirmationAsync(booking, restaurant);
        }
    }

    /// <summary>
    /// Resolves an "Any section" request by writing concrete ids back onto
    /// <paramref name="bookingDto"/>, so everything downstream runs unchanged. A hold the caller
    /// already owns is adopted rather than re-raced; otherwise a fresh one is placed atomically.
    /// The resulting <see cref="BookingDto.HoldId"/> is always the one to release after persisting.
    /// </summary>
    private async Task ResolveAutoAssignAsync(BookingDto bookingDto, Restaurant restaurant, DateTime bookingDate)
    {
        if (await TryAdoptExistingHoldAsync(bookingDto, restaurant, bookingDate))
        {
            return;
        }

        IReadOnlyList<TableCandidate> candidates = await _autoAssigner.BuildCandidatesAsync(
            restaurant, bookingDto.Seats, bookingDate);

        if (candidates.Count == 0)
        {
            throw new ConflictException("No tables are available for the requested time and party size.") { Code = ErrorCodes.BookingNoTablesAvailable };
        }

        AutoAssignResult assigned = _holdService.PlaceAutoHold(
            restaurant.Id,
            candidates,
            bookingDate,
            currentHoldId: bookingDto.HoldId,
            restaurant.DefaultBookingDurationMinutes)
            ?? throw new ConflictException("All suitable tables are currently being held by other users. Please try again shortly.") { Code = ErrorCodes.BookingAllTablesHeld };

        if (assigned.IsGroup)
        {
            AssignGroup(bookingDto, assigned.TableGroupId, assigned.Members, assigned.SectionId);
        }
        else
        {
            bookingDto.TableId = assigned.TableId;
            bookingDto.SectionId = assigned.SectionId;
        }

        bookingDto.HoldId = assigned.HoldId;
    }

    /// <summary>
    /// A hold was placed atomically, so the unit behind it is the caller's until the booking lands
    /// or the hold expires — adopting it avoids racing for a second one. The hold only guards
    /// against other in-memory holds though, so the database is still asked whether the unit was
    /// booked in the meantime; if it was, the caller falls through to a fresh candidate search.
    /// </summary>
    private async Task<bool> TryAdoptExistingHoldAsync(BookingDto bookingDto, Restaurant restaurant, DateTime bookingDate)
    {
        if (string.IsNullOrEmpty(bookingDto.HoldId))
        {
            return false;
        }

        HoldEntry? held = _holdService.GetHold(bookingDto.HoldId);
        if (held is null || held.RestaurantId != restaurant.Id)
        {
            return false;
        }

        bool booked = await _bookingRepository.IsUnitBookedOnDateAsync(
            tableId: held.IsGroup ? null : held.TableId,
            tableGroupId: held.TableGroupId,
            bookingDate,
            restaurant.DefaultBookingDurationMinutes);
        if (booked)
        {
            return false;
        }

        if (held.IsGroup)
        {
            AssignGroup(bookingDto, held.TableGroupId, held.Members, held.SectionId);
        }
        else
        {
            bookingDto.TableId = held.TableId;
            bookingDto.SectionId = held.SectionId;
        }

        return true;
    }

    /// <summary>
    /// A group booking reserves the group, not one of its tables, so <c>TableId</c> is cleared —
    /// leaving a stale one behind would route the request back down the single-table path.
    /// </summary>
    private static void AssignGroup(BookingDto bookingDto, int? tableGroupId, IReadOnlyList<int> memberTableIds, int sectionId)
    {
        bookingDto.TableGroupId = tableGroupId;
        bookingDto.MemberTableIds = memberTableIds;
        bookingDto.SectionId = sectionId;
        bookingDto.TableId = null;
    }

    /// <summary>
    /// Persists a booking against a combinable-table group. The booking is written with
    /// <see cref="Booking.TableGroupId"/> set and <see cref="Booking.TableId"/> null: it reserves
    /// the group, not one of its tables.
    /// </summary>
    private async Task<BookingDto> CreateGroupBookingAsync(BookingDto bookingDto, Restaurant restaurant, DateTime bookingDate)
    {
        TableGroup group = await _tableGroupRepository.GetByIdWithMembersAsync(bookingDto.TableGroupId!.Value, restaurant.Id)
            ?? throw new NotFoundException("The selected table group no longer exists.") { Code = ErrorCodes.TableGroupNotFound };

        RejectIfGroupCannotSeat(group, restaurant, bookingDto.Seats);

        // Member tables come from the persisted group, never from the request: MemberTableIds is
        // part of the public POST body, so trusting it would let a caller omit members and skip the
        // hold check for the ones they left out.
        var memberIds = group.Members.Select(m => m.TableId).ToList();
        int durationMinutes = restaurant.DefaultBookingDurationMinutes;

        bool groupConflict = await _bookingRepository.IsUnitBookedOnDateAsync(
            tableId: null, tableGroupId: group.Id, bookingDate, durationMinutes);
        if (groupConflict)
        {
            throw new ConflictException("One of the combined tables is already booked for that time.") { Code = ErrorCodes.TableGroupBookingConflict };
        }

        bool anyMemberHeldByOther = memberIds.Any(id => _holdService.IsTableHeld(
            id, bookingDate, excludeHoldId: bookingDto.HoldId, durationMinutes: durationMinutes));
        if (anyMemberHeldByOther)
        {
            throw new ConflictException("One of the combined tables is currently being held by another user. Please try again shortly.") { Code = ErrorCodes.TableGroupHoldConflict };
        }

        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate;
        booking.BookingRef = BookingRefFactory.GenerateFor(restaurant);
        booking.EndTime = bookingDate.AddMinutes(durationMinutes);
        booking.TableId = null;
        booking.TableGroupId = group.Id;
        booking.TableGroup = group;
        // Kept so the admin grid can still group the booking by section.
        booking.SectionId = bookingDto.SectionId
            ?? group.Members.OrderBy(m => m.TableId).FirstOrDefault()?.Table?.SectionId;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        await AnnounceBookingAsync(newBooking, restaurant);

        return _mapper.ToDtoWithGroup(newBooking);
    }

    private static void RejectIfGroupCannotSeat(TableGroup group, Restaurant restaurant, int seats)
    {
        // A group that has lost members — a member table was deleted — is no longer a combinable
        // unit, and its stored CombinedSeats no longer describes anything real.
        if (group.Members.Count < 2)
        {
            throw new ConflictException("These tables can no longer be combined. Please pick another time or table.") { Code = ErrorCodes.TableGroupDisbanded };
        }

        if (seats > group.CombinedSeats)
        {
            throw new ConflictException(
                $"This group only has {group.CombinedSeats} combined seats, but {seats} guests were requested.")
            { Code = ErrorCodes.TableGroupSeatsExceeded, Args = new Dictionary<string, object> { ["seats"] = group.CombinedSeats, ["requested"] = seats } };
        }

        if (restaurant.ExceedsOversizeCap(group.CombinedSeats, seats))
        {
            throw new ConflictException(
                $"This group has {group.CombinedSeats} combined seats, which is too large for a party of {seats}.")
            { Code = ErrorCodes.TableGroupOversizeCap, Args = new Dictionary<string, object> { ["seats"] = group.CombinedSeats, ["partySize"] = seats } };
        }
    }

    // Admin-only read (see BookingsController) — the only path here that needs guest-visibility
    // redaction. GetBookingByRefAsync below is the customer's own unauthenticated lookup and must
    // never be redacted, so it deliberately does not route through BookingGuestVisibility.
    public virtual async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : BookingGuestVisibility.Apply(_mapper.ToDtoWithGroup(booking), _currentUser);
    }

    public virtual async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDtoWithGroup(booking);
    }

    // Admin-only read (see BookingsController) — see the note on GetBookingByIdAsync above.
    public virtual async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        IEnumerable<Booking> bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return BookingGuestVisibility.Apply(_mapper.ToDtoWithGroupList(bookings), _currentUser);
    }

    public virtual async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        Booking booking = _mapper.ToEntity(bookingDto);
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);

        if (bookingDto.Seats > 0 && booking.TableId.HasValue)
        {
            Table? table = await _tableRepository.GetByIdAsync(booking.TableId.Value);
            RejectIfTableCannotSeat(table, restaurant, bookingDto.Seats);
        }

        if (!booking.EndTime.HasValue || booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddMinutes(restaurant?.DefaultBookingDurationMinutes ?? 60);
        }

        await _bookingRepository.UpdateAsync(booking);
    }

    public virtual async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }

    public virtual async Task<string?> GetRestaurantNameAsync(int restaurantId)
    {
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId);
        return restaurant?.Name;
    }

    public virtual async Task<bool> CancelBookingAsync(string bookingRef, string email)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        if (booking == null)
        {
            Console.WriteLine($"[CancelBookingAsync] Booking not found for ref: {bookingRef}");
            return false;
        }

        if (!string.Equals(booking.CustomerEmail?.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"[CancelBookingAsync] Email mismatch for ref: {bookingRef}. DB: {booking.CustomerEmail}, Input: {email}");
            return false;
        }

        if (booking.IsCancelled)
        {
            return true;
        }

        if (!booking.CanBeCancelledAt(DateTime.UtcNow))
        {
            throw new ConflictException("Cannot cancel a booking that has already passed.") { Code = ErrorCodes.BookingAlreadyPast };
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _bookingRepository.UpdateAsync(booking);

        if (_notificationQueue != null)
        {
            Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);
            _notificationQueue.EnqueueBookingCancelled(booking, restaurant?.Name ?? "");
        }

        return true;
    }
}
