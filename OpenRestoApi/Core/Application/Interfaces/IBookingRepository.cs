namespace OpenRestoApi.Core.Application.Interfaces;

using OpenRestoApi.Core.Domain;
public interface IBookingRepository
{
    Task<IEnumerable<Booking>> GetAllAvailableBookingsAsync();
    Task<Booking?> GetBookingByIdAsync(int id);
    Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId);
}