using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly ITableRepository _tableRepository;
    private readonly ISectionRepository _sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository;
    private readonly IHoldService _holdService;
    private readonly BookingMapper _mapper;

    public BookingService(
        IBookingRepository bookingRepository,
        ITableRepository tableRepository,
        ISectionRepository sectionRepository,
        IRestaurantRepository restaurantRepository,
        IHoldService holdService,
        BookingMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _tableRepository = tableRepository;
        _sectionRepository = sectionRepository;
        _restaurantRepository = restaurantRepository;
        _holdService = holdService;
        _mapper = mapper;
    }

    /// <summary>
    /// Creates a booking after validating:
    /// 1. No confirmed booking exists for the same table on the same date.
    /// 2. No other user holds the table for the same date (the submitter's own hold is excluded).
    /// If a holdId is provided and valid, it is released after the booking is persisted.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the table is unavailable.</exception>
    public async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        // 1. Check DB for an existing confirmed booking on the same table+date
        var alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            bookingDto.TableId, bookingDto.Date);

        if (alreadyBooked)
        {
            throw new InvalidOperationException("This table is already booked for that date.");
        }

        // 2. Check for an active hold by someone else
        //    (exclude the submitter's own hold so they're not blocked by themselves)
        var heldByOther = _holdService.IsTableHeld(
            bookingDto.TableId, bookingDto.Date, excludeHoldId: bookingDto.HoldId);

        if (heldByOther)
        {
            throw new InvalidOperationException("This table is currently being held by another user. Please try again shortly.");
        }

        // 3. Persist the booking
        var booking = _mapper.ToEntity(bookingDto);
        booking.BookingRef = BookingRefGenerator.Generate();
        booking.EndTime = bookingDto.Date.AddHours(1);
        booking.Table = (await _tableRepository.GetByIdAsync(bookingDto.TableId))!;
        booking.Section = (await _sectionRepository.GetByIdAsync(bookingDto.SectionId))!;
        booking.Restaurant = (await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId))!;

        var newBooking = await _bookingRepository.AddAsync(booking);

        // 4. Release the hold now that the booking is confirmed
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        return _mapper.ToDto(newBooking);
    }

    public async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        var booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        var booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        var bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.ToDtoList(bookings);
    }

    public async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        var booking = _mapper.ToEntity(bookingDto);
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }
}
