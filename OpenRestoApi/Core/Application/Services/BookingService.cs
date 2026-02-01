using OpenRestoApi.Core.Application.Interfaces;
using AutoMapper;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly ITableRepository _tableRepository;
    private readonly ISectionRepository _sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository;
    private readonly IMapper _mapper;

    public BookingService(
        IBookingRepository bookingRepository,
        ITableRepository tableRepository,
        ISectionRepository sectionRepository,
        IRestaurantRepository restaurantRepository,
        IMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _tableRepository = tableRepository;
        _sectionRepository = sectionRepository;
        _restaurantRepository = restaurantRepository;
        _mapper = mapper;
    }

    public async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        var booking = _mapper.Map<Booking>(bookingDto);

        booking.Table = await _tableRepository.GetByIdAsync(bookingDto.TableId);
        booking.Section = await _sectionRepository.GetByIdAsync(bookingDto.SectionId);
        booking.Restaurant = await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId);

        var newBooking = await _bookingRepository.AddAsync(booking);
        return _mapper.Map<BookingDto>(newBooking);
    }

    public async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        var booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.Map<BookingDto>(booking);
    }

    public async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        var bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.Map<IEnumerable<BookingDto>>(bookings);
    }

    public async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        var booking = _mapper.Map<Booking>(bookingDto);
        await _bookingRepository.UpdateAsync(booking);
    }

    public async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }
}
