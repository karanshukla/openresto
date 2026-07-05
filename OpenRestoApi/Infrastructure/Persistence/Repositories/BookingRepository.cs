using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories
{
    [OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.AvailabilityServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.AdminServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.NotificationServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerRestoreTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerSectionsReorderTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerUpdateTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerEmailTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerLookupTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Integration.RepositoryTests")]
    [ExternalAccessAllowed]
    internal class BookingRepository(AppDbContext db) : IBookingRepository
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

        public async Task<bool> IsTableBookedOnDateAsync(int tableId, DateTime bookingDate, int durationMinutes = 60)
        {
            DateTime newStart = bookingDate.ToUniversalTime();
            DateTime newEnd = newStart.AddMinutes(durationMinutes);
            DateTime thresholdStart = newStart.AddMinutes(-durationMinutes); // For legacy bookings without EndTime

            // Check if any existing booking's time window overlaps the new one
            // Condition: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
            return await _db.Bookings.AnyAsync(b =>
                b.TableId == tableId &&
                !b.IsCancelled &&
                b.Date < newEnd &&
                (b.EndTime != null ? b.EndTime > newStart : b.Date > thresholdStart));
        }

        public async Task<IEnumerable<Booking>> GetActiveBookingsForDateAsync(int restaurantId, DateTime bookingDate)
        {
            // Define a range in UTC that is guaranteed to cover the entire day regardless of timezone.
            // A 48-hour window centered on the UTC date is safe.
            DateTime start = bookingDate.Date.AddDays(-1);
            DateTime end = bookingDate.Date.AddDays(2);

            return await _db.Bookings
                .Where(b => b.RestaurantId == restaurantId && !b.IsCancelled && b.Date >= start && b.Date < end)
                .ToListAsync();
        }

        // ── Bundle 2 additions ─────────────────────────────────────────────────────

        public async Task<Booking?> FindByIdAsync(int id)
        {
            return await _db.Bookings.FindAsync(id);
        }

        public async Task<int> CountActiveAsync()
        {
            return await _db.Bookings.CountAsync(b => !b.IsCancelled);
        }

        public async Task<int> SumActiveSeatsAsync()
        {
            return await _db.Bookings.Where(b => !b.IsCancelled).SumAsync(b => (int?)b.Seats) ?? 0;
        }

        public async Task<int> CountActiveByDayAsync(DateTime startUtc, DateTime endUtc)
        {
            return await _db.Bookings.CountAsync(b => !b.IsCancelled && b.Date >= startUtc && b.Date < endUtc);
        }

        public async Task<List<Booking>> GetInProgressForRestaurantAsync(int restaurantId, DateTime nowUtc, int defaultDurationMinutes)
        {
            return await _db.Bookings
                .Include(b => b.Restaurant)
                .Include(b => b.Section)
                .Include(b => b.Table)
                .Where(b => b.RestaurantId == restaurantId &&
                            !b.IsCancelled &&
                            b.Date <= nowUtc &&
                            (b.EndTime.HasValue ? b.EndTime.Value > nowUtc : b.Date.AddMinutes(defaultDurationMinutes) > nowUtc))
                .ToListAsync();
        }

        public async Task<List<Booking>> GetForRestaurantInUtcRangeAsync(int restaurantId, DateTime startUtc, DateTime endUtc)
        {
            return await _db.Bookings
                .Include(b => b.Restaurant)
                .Include(b => b.Section)
                .Include(b => b.Table)
                .Where(b => b.RestaurantId == restaurantId &&
                            b.Date >= startUtc && b.Date < endUtc &&
                            !b.IsCancelled)
                .OrderBy(b => b.Date)
                .ToListAsync();
        }

        public async Task<bool> HasConflictAsync(int? tableId, DateTime newStart, DateTime newEnd, int fallbackDurationMinutes, int? excludeBookingId = null)
        {
            return await _db.Bookings.AnyAsync(b =>
                b.TableId == tableId &&
                !b.IsCancelled &&
                (excludeBookingId == null || b.Id != excludeBookingId.Value) &&
                b.Date < newEnd &&
                (b.EndTime != null ? b.EndTime > newStart : b.Date.AddMinutes(fallbackDurationMinutes) > newStart));
        }

        public async Task<int> CountDistinctBookedTablesAsync(int restaurantId, DateTime startUtc, DateTime endUtc)
        {
            return await _db.Bookings
                .Where(b => b.RestaurantId == restaurantId && !b.IsCancelled && b.TableId != null && b.Date >= startUtc && b.Date < endUtc)
                .Select(b => b.TableId)
                .Distinct()
                .CountAsync();
        }

        public async Task AddRangeAsync(IEnumerable<Booking> bookings)
        {
            await _db.Bookings.AddRangeAsync(bookings);
        }

        public void RemoveRange(IEnumerable<Booking> bookings)
        {
            _db.Bookings.RemoveRange(bookings);
        }

        public async Task SaveChangesAsync()
        {
            await _db.SaveChangesAsync();
        }

        public async Task<List<Booking>> GetBySectionOrTablesAsync(int sectionId, IReadOnlyList<int> tableIds)
        {
            return await _db.Bookings
                .Where(b => b.SectionId == sectionId || (b.TableId != null && tableIds.Contains(b.TableId.Value)))
                .ToListAsync();
        }

        public async Task<List<Booking>> GetByTableAsync(int tableId)
        {
            return await _db.Bookings.Where(b => b.TableId == tableId).ToListAsync();
        }
    }
}
