using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BookingService(
    IBookingRepository bookingRepository,
    ITableRepository tableRepository,
    ISectionRepository sectionRepository,
    IRestaurantRepository restaurantRepository,
    IHoldService holdService,
    BookingMapper mapper)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;
    private readonly BookingMapper _mapper = mapper;

    /// <summary>
    /// Creates a booking after validating:
    /// 1. No confirmed booking exists for the same table on the same date.
    /// 2. No other user holds the table for the same date (the submitter's own hold is excluded).
    /// If a holdId is provided and valid, it is released after the booking is persisted.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the table is unavailable.</exception>
    public async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        // 0. Reject bookings in the past
        if (bookingDto.Date < DateTime.UtcNow.AddMinutes(-5))
        {
            throw new InvalidOperationException("Cannot create a booking in the past.");
        }

        // 1. Check DB for an existing confirmed booking on the same table+date
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            bookingDto.TableId, bookingDto.Date);

        if (alreadyBooked)
        {
            throw new InvalidOperationException("This table is already booked for that date.");
        }

        // 2. Check for an active hold by someone else
        //    (exclude the submitter's own hold so they're not blocked by themselves)
        bool heldByOther = _holdService.IsTableHeld(
            bookingDto.TableId, bookingDto.Date, excludeHoldId: bookingDto.HoldId);

        if (heldByOther)
        {
            throw new InvalidOperationException("This table is currently being held by another user. Please try again shortly.");
        }

        // 3. Check for seat capacity
        Table? table = await _tableRepository.GetByIdAsync(bookingDto.TableId);
        if (table != null && bookingDto.Seats > table.Seats)
        {
            throw new InvalidOperationException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
        }

        // 4. Persist the booking
        Booking booking = _mapper.ToEntity(bookingDto);
        booking.BookingRef = BookingRefGenerator.Generate();
        booking.EndTime = bookingDto.Date.AddHours(1);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(bookingDto.SectionId))!;
        booking.Restaurant = (await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId))!;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        // 4. Release the hold now that the booking is confirmed
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        return _mapper.ToDto(newBooking);
    }

    public async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        IEnumerable<Booking> bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.ToDtoList(bookings);
    }

    public async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        Booking booking = _mapper.ToEntity(bookingDto);
        
        // Ensure EndTime is valid if it's being updated or if Date changed
        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }
        else if (!booking.EndTime.HasValue)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }

        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }
}
