using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface IBookingRepository
{
    Task<Booking?> GetByIdAsync(int id);
    Task<Booking?> GetByRefAsync(string bookingRef);
    Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId);
    Task<Booking> AddAsync(Booking booking);
    Task<Booking> UpdateAsync(Booking booking);
    Task DeleteAsync(int id);
    /// <summary>Returns true if a confirmed booking exists for this table on the given date (any time).</summary>
    Task<bool> IsTableBookedOnDateAsync(int tableId, DateTime bookingDate);
    /// <summary>Returns all non-cancelled bookings for a specific restaurant and local date.</summary>
    Task<IEnumerable<Booking>> GetActiveBookingsForDateAsync(int restaurantId, DateTime bookingDate);
}
