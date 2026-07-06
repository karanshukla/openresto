using OpenRestoApi.Core.Application.DTOs;
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
    IBookingConfirmationService? confirmationService = null,
    INotificationQueue? notificationQueue = null)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;
    private readonly BookingMapper _mapper = mapper;
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
            throw new ArgumentException("Restaurant not found.");
        }

        if (restaurant.IsPaused())
        {
            throw new InvalidOperationException("Bookings for this restaurant are currently paused. Please try again later.");
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(bookingDto.Date, restaurant.Timezone);

        // 0. Reject bookings in the past (same 5-min tolerance as booking cancellation).
        if (bookingDate < DateTime.UtcNow.AddMinutes(-Booking.CancellationGraceMinutes))
        {
            throw new InvalidOperationException("Cannot create a booking in the past.");
        }

        // Walk-in-only locations (or walk-in-only days) never take online bookings.
        // Admin-recorded bookings use AdminService.CreateBookingAsync and are unaffected.
        if (restaurant.IsWalkInOnlyAt(bookingDate))
        {
            throw new InvalidOperationException(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day. Please choose another day or just come in.");
        }

        if (bookingDto.TableId is null || bookingDto.SectionId is null)
            throw new ArgumentException("TableId and SectionId are required.");

        // 1. Check DB for an existing confirmed booking on the same table+date
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            bookingDto.TableId.Value, bookingDate, restaurant.DefaultBookingDurationMinutes);

        if (alreadyBooked)
        {
            throw new InvalidOperationException("This table is already booked for that time.");
        }

        // 2. Check for an active hold by someone else
        bool heldByOther = _holdService.IsTableHeld(
            bookingDto.TableId.Value, bookingDate, excludeHoldId: bookingDto.HoldId,
            durationMinutes: restaurant.DefaultBookingDurationMinutes);

        if (heldByOther)
        {
            throw new InvalidOperationException("This table is currently being held by another user. Please try again shortly.");
        }

        // 3. Check for seat capacity
        Table? table = await _tableRepository.GetByIdAsync(bookingDto.TableId.Value);
        if (table != null && bookingDto.Seats > table.Seats)
        {
            throw new InvalidOperationException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
        }

        // 4. Persist the booking
        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate; // Use normalized date
        booking.BookingRef = BookingRefGenerator.Generate();
        booking.EndTime = bookingDate.AddMinutes(restaurant.DefaultBookingDurationMinutes);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(bookingDto.SectionId.Value))!;
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

        return _mapper.ToDto(newBooking);
    }

    public virtual async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public virtual async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public virtual async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        IEnumerable<Booking> bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.ToDtoList(bookings);
    }

    public virtual async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        Booking booking = _mapper.ToEntity(bookingDto);

        // Check for seat capacity if seats are being updated
        if (bookingDto.Seats > 0)
        {
            Table? table = booking.TableId.HasValue ? await _tableRepository.GetByIdAsync(booking.TableId.Value) : null;
            if (table != null && bookingDto.Seats > table.Seats)
            {
                throw new InvalidOperationException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
            }
        }

        // Ensure EndTime is valid if it's being updated or if Date changed
        if (!booking.EndTime.HasValue || booking.EndTime.Value < booking.Date)
        {
            Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);
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
            throw new InvalidOperationException("Cannot cancel a booking that has already passed.");
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
