using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories
{
    public class BookingRepository(AppDbContext db) : IBookingRepository
    {
        private readonly AppDbContext _db = db;

        public async Task<Booking> AddAsync(Booking booking)
        {
            _db.Bookings.Add(booking);
            await _db.SaveChangesAsync();
            return booking;
        }

        public async Task<Booking?> GetByIdAsync(int id)
        {
            return await _db.Bookings
                .Include(b => b.Table)
                .Include(b => b.Section)
                .Include(b => b.Restaurant)
                .FirstOrDefaultAsync(b => b.Id == id);
        }

        public async Task<Booking?> GetByRefAsync(string bookingRef)
        {
            return await _db.Bookings
                .Include(b => b.Table)
                .Include(b => b.Section)
                .Include(b => b.Restaurant)
                .FirstOrDefaultAsync(b => b.BookingRef == bookingRef);
        }

        public async Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId)
        {
            return await _db.Bookings
                .Include(b => b.Table)
                .Include(b => b.Section)
                .Include(b => b.Restaurant)
                .Where(b => b.Restaurant.Id == restaurantId)
                .ToListAsync();
        }

        public async Task<Booking> UpdateAsync(Booking booking)
        {
            _db.Entry(booking).State = EntityState.Modified;
            await _db.SaveChangesAsync();
            return booking;
        }

        public async Task DeleteAsync(int id)
        {
            Booking? booking = await _db.Bookings.FindAsync(id);
            if (booking != null)
            {
                _db.Bookings.Remove(booking);
                await _db.SaveChangesAsync();
            }
        }

        public async Task<bool> IsTableBookedOnDateAsync(int tableId, DateTime bookingDate)
        {
            DateTime newStart = bookingDate.ToUniversalTime();
            DateTime newEnd = newStart.AddHours(1);
            // Check if any existing booking's time window overlaps the new one
            return await _db.Bookings.AnyAsync(b =>
                b.TableId == tableId &&
                !b.IsCancelled &&
                b.Date < newEnd &&
                (b.EndTime != null ? b.EndTime > newStart : b.Date.AddHours(1) > newStart));
        }
    }
}
