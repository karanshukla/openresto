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
    INotificationQueue? notificationQueue = null)
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

    /// <summary>
    /// Creates a booking after validating:
    /// 1. No confirmed booking exists for the same table on the same date.
    /// 2. No other user holds the table for the same date (the submitter's own hold is excluded).
    /// If a holdId is provided and valid, it is released after the booking is persisted.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the table is unavailable.</exception>
    public virtual async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        // 1. Validate restaurant-level pause first
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId);
        if (restaurant == null)
        {
            throw new NotFoundException("Restaurant not found.");
        }

        if (restaurant.IsPaused())
        {
            throw new ConflictException("Bookings for this restaurant are currently paused. Please try again later.");
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(bookingDto.Date, restaurant.Timezone);

        // 0. Reject bookings in the past (same 5-min tolerance as booking cancellation).
        if (bookingDate < DateTime.UtcNow.AddMinutes(-Booking.CancellationGraceMinutes))
        {
            throw new ConflictException("Cannot create a booking in the past.");
        }

        // Walk-in-only locations (or walk-in-only days) never take online bookings.
        // Admin-recorded bookings use AdminService.CreateBookingAsync and are unaffected.
        if (restaurant.IsWalkInOnlyAt(bookingDate))
        {
            throw new ConflictException(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day. Please choose another day or just come in.");
        }

        // Party size guard — defense in depth behind the DTO [Range] annotation. Rejects 0/negative
        // or absurdly large parties with a clear message; without this, a 0-seat booking on a concrete
        // table would pass the upper-bound capacity check and persist.
        if (bookingDto.Seats < BookingLimits.MinSeats || bookingDto.Seats > BookingLimits.MaxSeats)
        {
            throw new ValidationException(
                $"Party size must be between {BookingLimits.MinSeats} and {BookingLimits.MaxSeats}.");
        }

        // A combinable-table group booking (#272) selected explicitly takes precedence: route it
        // before the TableId/SectionId + auto-assign logic, which assumes a single table. (Auto-assign
        // that resolves to a group sets TableGroupId too and re-enters this branch below.)
        if (bookingDto.TableGroupId.HasValue && bookingDto.TableId is null)
        {
            return await CreateGroupBookingAsync(bookingDto, restaurant, bookingDate);
        }

        if (bookingDto.TableId is null || bookingDto.SectionId is null)
        {
            // Exactly one of the two is null — that's ambiguous; reject. Both null means
            // "Any section" auto-assign, which we resolve below before the rest of the
            // method (which assumes concrete ids).
            if (bookingDto.TableId is null ^ bookingDto.SectionId is null)
            {
                throw new ValidationException("Specify both TableId and SectionId, or neither for auto-assign.");
            }

            await ResolveAutoAssignAsync(bookingDto, restaurant, bookingDate);
        }

        // Auto-assign may have resolved to a group (TableGroupId set, TableId null). Route into the
        // group path here; the explicit-group case above already returned.
        if (bookingDto.TableGroupId.HasValue)
        {
            return await CreateGroupBookingAsync(bookingDto, restaurant, bookingDate);
        }

        // After auto-assign resolution (or an explicit selection) both ids are guaranteed set.
        int tableId = bookingDto.TableId!.Value;
        int sectionId = bookingDto.SectionId!.Value;

        // 1. Check DB for an existing confirmed booking on the same table+date. Group-aware: a table
        //    is also "booked" when its combinable group (or any sibling member) has a booking for the
        //    window, since those bookings reserve the same physical tables. A persisted group booking
        //    stores TableId = null, so the table-only check would miss it — IsUnitBookedOnDateAsync
        //    resolves the membership and matches it.
        bool alreadyBooked = await _bookingRepository.IsUnitBookedOnDateAsync(
            tableId, tableGroupId: null, bookingDate, restaurant.DefaultBookingDurationMinutes);

        if (alreadyBooked)
        {
            throw new ConflictException("This table is already booked for that time.");
        }

        // 2. Check for an active hold by someone else
        bool heldByOther = _holdService.IsTableHeld(
            tableId, bookingDate, excludeHoldId: bookingDto.HoldId,
            durationMinutes: restaurant.DefaultBookingDurationMinutes);

        if (heldByOther)
        {
            throw new ConflictException("This table is currently being held by another user. Please try again shortly.");
        }

        // 3. Check for seat capacity
        Table? table = await _tableRepository.GetByIdAsync(tableId);
        if (table != null && bookingDto.Seats > table.Seats)
        {
            throw new ConflictException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
        }

        // 3b. Reject oversized tables when the restaurant caps spare seats. Mirrors the
        // lower bound above and the AvailabilityService eligible-table filter, so a direct
        // POST (or an auto-assigned pick that slipped past the candidate filter) can't seat
        // a small party at a table the restaurant wants held for larger groups.
        if (table != null && restaurant.MaxTableOversizeSeats.HasValue
            && table.Seats - bookingDto.Seats > restaurant.MaxTableOversizeSeats.Value)
        {
            throw new ConflictException(
                $"This table has {table.Seats} seats, which is too large for a party of {bookingDto.Seats}.");
        }

        // 4. Persist the booking
        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate; // Use normalized date
        booking.BookingRef = BookingRefFactory.GenerateFor(restaurant);
        booking.EndTime = bookingDate.AddMinutes(restaurant.DefaultBookingDurationMinutes);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(sectionId))!;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        // 5. Release the hold now that the booking is confirmed
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        // 6. Admin push notification (fire-and-forget via background queue)
        if (_notificationQueue != null)
        {
            _notificationQueue.EnqueueBookingCreated(newBooking, restaurant.Name);
            _notificationQueue.EnqueueCapacityCheck(restaurant.Id, restaurant.Name, newBooking.Date);
        }

        // 7. Send booking confirmation email (best-effort, never fails the booking).
        // Delegated to BookingConfirmationService — BookingService no longer owns template
        // building or SMTP orchestration.
        if (_confirmationService != null)
        {
            await _confirmationService.SendConfirmationAsync(newBooking, restaurant);
        }

        return _mapper.ToDtoWithGroup(newBooking);
    }

    /// <summary>
    /// Resolves a "Any section" auto-assign booking request: populates
    /// <paramref name="bookingDto"/>.TableId/SectionId (and HoldId when a fresh hold is placed)
    /// so the caller's downstream checks and persistence work unchanged. If a valid
    /// <see cref="BookingDto.HoldId"/> was provided, the held table/section are adopted
    /// directly; otherwise the candidate pool is built and a new hold is placed atomically
    /// via <see cref="IHoldService.PlaceAutoHold"/>. Throws <see cref="ConflictException"/>
    /// when no candidate is free.
    /// </summary>
    private async Task ResolveAutoAssignAsync(BookingDto bookingDto, Restaurant restaurant, DateTime bookingDate)
    {
        // 1. If the caller already holds an auto-assigned table (or group), adopt it. This avoids a
        //    second race: the hold was placed atomically, so the held unit is "ours" until the booking
        //    lands or the hold expires.
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            HoldEntry? held = _holdService.GetHold(bookingDto.HoldId);
            if (held is not null && held.RestaurantId == restaurant.Id)
            {
                if (held.IsGroup)
                {
                    // Group hold — verify the group is still free of a confirmed booking (group-aware:
                    // catches the group itself, a member booked individually, or a member reserved by a
                    // sibling group booking), then adopt.
                    bool groupBooked = await _bookingRepository.IsUnitBookedOnDateAsync(
                        tableId: null,
                        tableGroupId: held.TableGroupId,
                        bookingDate,
                        restaurant.DefaultBookingDurationMinutes);

                    if (!groupBooked)
                    {
                        bookingDto.TableGroupId = held.TableGroupId;
                        bookingDto.MemberTableIds = held.Members;
                        bookingDto.SectionId = held.SectionId;
                        bookingDto.TableId = null;
                        return;
                    }
                }
                else
                {
                    // The hold is on a specific table — verify it still fits and isn't double-booked
                    // in the DB (the hold only guards against other in-memory holds). Group-aware: a
                    // group booking on this table's group would reserve it too. If something changed
                    // under us, fall through to the candidate search.
                    bool booked = await _bookingRepository.IsUnitBookedOnDateAsync(
                        held.TableId, tableGroupId: null, bookingDate, restaurant.DefaultBookingDurationMinutes);
                    if (!booked)
                    {
                        bookingDto.TableId = held.TableId;
                        bookingDto.SectionId = held.SectionId;
                        return;
                    }
                }
            }
        }

        // 2. No usable hold — build candidates and place a fresh hold atomically. The new
        // hold id is stashed on the DTO so the existing "release hold after persist" step
        // at the end of CreateBookingAsync cleans it up.
        IReadOnlyList<TableCandidate> candidates = await _autoAssigner.BuildCandidatesAsync(
            restaurant, bookingDto.Seats, bookingDate);

        if (candidates.Count == 0)
        {
            throw new ConflictException("No tables are available for the requested time and party size.");
        }

        AutoAssignResult? assigned = _holdService.PlaceAutoHold(
            restaurant.Id,
            candidates,
            bookingDate,
            currentHoldId: bookingDto.HoldId,
            restaurant.DefaultBookingDurationMinutes);

        if (assigned is null)
        {
            throw new ConflictException("All suitable tables are currently being held by other users. Please try again shortly.");
        }

        if (assigned.IsGroup)
        {
            // Auto-assign resolved to a combinable group — record the group identity (and clear any
            // stale TableId) so CreateBookingAsync routes into the group-booking path.
            bookingDto.TableGroupId = assigned.TableGroupId;
            bookingDto.MemberTableIds = assigned.Members;
            bookingDto.SectionId = assigned.SectionId;
            bookingDto.TableId = null;
        }
        else
        {
            bookingDto.TableId = assigned.TableId;
            bookingDto.SectionId = assigned.SectionId;
        }
        bookingDto.HoldId = assigned.HoldId; // ensure the release-at-end step tears it down
    }

    /// <summary>
    /// Persists a combinable-table group booking (#272). Validates the group exists and belongs to the
    /// restaurant, the party fits within <see cref="TableGroup.CombinedSeats"/> (and the restaurant's
    /// optional oversize cap), and that <b>every member table</b> is free of a conflicting confirmed
    /// booking or another user's hold for the slot. The booking is written with <see cref="Booking.TableGroupId"/>
    /// set and <see cref="Booking.TableId"/> null — a group booking reserves the group, not one table.
    /// </summary>
    private async Task<BookingDto> CreateGroupBookingAsync(BookingDto bookingDto, Restaurant restaurant, DateTime bookingDate)
    {
        TableGroup? group = await _tableGroupRepository.GetByIdWithMembersAsync(bookingDto.TableGroupId!.Value, restaurant.Id);
        if (group == null)
        {
            throw new NotFoundException("The selected table group no longer exists.");
        }

        // A group that has lost members (e.g. a member table was deleted) is not a combinable unit
        // any more and its CombinedSeats no longer describes anything real — refuse rather than seat
        // a party against phantom capacity.
        if (group.Members.Count < 2)
        {
            throw new ConflictException("These tables can no longer be combined. Please pick another time or table.");
        }

        // Capacity: party must fit within the group's stored combined capacity.
        if (bookingDto.Seats > group.CombinedSeats)
        {
            throw new ConflictException(
                $"This group only has {group.CombinedSeats} combined seats, but {bookingDto.Seats} guests were requested.");
        }

        // Oversize cap applies to groups too — don't seat a small party at a much larger combined group.
        if (restaurant.MaxTableOversizeSeats.HasValue
            && group.CombinedSeats - bookingDto.Seats > restaurant.MaxTableOversizeSeats.Value)
        {
            throw new ConflictException(
                $"This group has {group.CombinedSeats} combined seats, which is too large for a party of {bookingDto.Seats}.");
        }

        // Member tables always come from the persisted group, never from the request: MemberTableIds
        // is part of the public POST body, so trusting it would let a caller submit an empty/partial
        // list and skip the other-user hold check below for the members it omitted.
        var memberIds = group.Members.Select(m => m.TableId).ToList();
        int durationMinutes = restaurant.DefaultBookingDurationMinutes;

        // Group-aware conflict check: a single query covers (a) any member already booked on its own,
        // (b) the group already booked, and (c) a member reserved by a sibling/other group booking
        // (those bookings store TableId = null, so the old table-only check could not see them and
        // allowed the same physical table to be double-booked).
        bool groupConflict = await _bookingRepository.IsUnitBookedOnDateAsync(
            tableId: null, tableGroupId: group.Id, bookingDate, durationMinutes);
        if (groupConflict)
        {
            throw new ConflictException("One of the combined tables is already booked for that time.");
        }

        foreach (int memberId in memberIds)
        {
            bool heldByOther = _holdService.IsTableHeld(
                memberId, bookingDate, excludeHoldId: bookingDto.HoldId, durationMinutes: durationMinutes);
            if (heldByOther)
            {
                throw new ConflictException("One of the combined tables is currently being held by another user. Please try again shortly.");
            }
        }

        // Persist the booking against the group. TableId stays null (1:1 with the group); SectionId is
        // set from the first member so the admin grid can still group by section.
        int? sectionId = bookingDto.SectionId
            ?? group.Members.OrderBy(m => m.TableId).FirstOrDefault()?.Table?.SectionId;

        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate;
        booking.BookingRef = BookingRefFactory.GenerateFor(restaurant);
        booking.EndTime = bookingDate.AddMinutes(durationMinutes);
        booking.TableId = null;
        booking.TableGroupId = group.Id;
        booking.TableGroup = group; // Attach the loaded group so the DTO/email display enrichment works.
        booking.SectionId = sectionId;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        // Release the hold now that the booking is confirmed.
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        if (_notificationQueue != null)
        {
            _notificationQueue.EnqueueBookingCreated(newBooking, restaurant.Name);
            _notificationQueue.EnqueueCapacityCheck(restaurant.Id, restaurant.Name, newBooking.Date);
        }

        if (_confirmationService != null)
        {
            await _confirmationService.SendConfirmationAsync(newBooking, restaurant);
        }

        return _mapper.ToDtoWithGroup(newBooking);
    }

    public virtual async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.ToDtoWithGroup(booking);
    }

    public virtual async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDtoWithGroup(booking);
    }

    public virtual async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        IEnumerable<Booking> bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.ToDtoWithGroupList(bookings);
    }

    public virtual async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        Booking booking = _mapper.ToEntity(bookingDto);
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);

        // Check for seat capacity if seats are being updated
        if (bookingDto.Seats > 0)
        {
            Table? table = booking.TableId.HasValue ? await _tableRepository.GetByIdAsync(booking.TableId.Value) : null;
            if (table != null && bookingDto.Seats > table.Seats)
            {
                throw new ConflictException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
            }

            // Oversize check — mirrors CreateBookingAsync and the availability feed so an edit
            // can't move a small party onto a table the restaurant caps for larger groups.
            if (table != null && restaurant?.MaxTableOversizeSeats.HasValue == true
                && table.Seats - bookingDto.Seats > restaurant.MaxTableOversizeSeats.Value)
            {
                throw new ConflictException(
                    $"This table has {table.Seats} seats, which is too large for a party of {bookingDto.Seats}.");
            }
        }

        // Ensure EndTime is valid if it's being updated or if Date changed
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
            throw new ConflictException("Cannot cancel a booking that has already passed.");
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
