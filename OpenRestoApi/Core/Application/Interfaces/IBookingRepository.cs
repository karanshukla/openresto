using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface IBookingRepository
{
    Task<Booking?> GetByIdAsync(int id);
    Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId);
    Task<Booking> AddAsync(Booking booking);
    Task<Booking> UpdateAsync(Booking booking);
    Task DeleteAsync(int id);
}