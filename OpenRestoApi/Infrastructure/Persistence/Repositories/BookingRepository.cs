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
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.HoldPolicyServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.NotificationServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingNotificationServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Services.TableAutoAssignerTests")]
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
                .Include(b => b.TableGroup)!
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.Table)
                .Include(b => b.Restaurant)
                .FirstOrDefaultAsync(b => b.Id == id);
        }

        public async Task<Booking?> GetByRefAsync(string bookingRef)
        {
            return await _db.Bookings
                .Include(b => b.Table)
                .Include(b => b.Section)
                .Include(b => b.TableGroup)!
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.Table)
                .Include(b => b.Restaurant)
                .FirstOrDefaultAsync(b => b.BookingRef == bookingRef);
        }

        public async Task<IEnumerable<Booking>> GetBookingsByRestaurantIdAsync(int restaurantId)
        {
            return await _db.Bookings
                .Include(b => b.Table)
                .Include(b => b.Section)
                .Include(b => b.TableGroup)!
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.Table)
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

        /// <summary>
        /// Group-aware conflict check. Resolves the set of physical table ids and group ids that count
        /// as "the unit being booked", then returns true if any non-cancelled booking overlapping the
        /// window reserves one of those tables (directly or via a group), or one of those groups.
        /// See <see cref="IBookingRepository.IsUnitBookedOnDateAsync"/> for the contract.
        /// </summary>
        public async Task<bool> IsUnitBookedOnDateAsync(
            int? tableId,
            int? tableGroupId,
            DateTime bookingDate,
            int durationMinutes = 60)
        {
            DateTime newStart = bookingDate.ToUniversalTime();
            DateTime newEnd = newStart.AddMinutes(durationMinutes);
            DateTime thresholdStart = newStart.AddMinutes(-durationMinutes);

            // Resolve every table id that counts as reserved by this unit. Booking a table also
            // reserves its group's other members (they can't be pushed together while one is taken);
            // booking a group reserves all of its members.
            var reservedTableIds = new HashSet<int>();

            if (tableGroupId.HasValue)
            {
                foreach (TableGroupMembership m in await _db.TableGroupMemberships
                    .Where(m => m.TableGroupId == tableGroupId.Value).ToListAsync())
                {
                    reservedTableIds.Add(m.TableId);
                }
            }

            if (tableId.HasValue)
            {
                reservedTableIds.Add(tableId.Value);
            }

            if (reservedTableIds.Count == 0)
            {
                return false;
            }

            // Expand to every group that contains ANY reserved table — booking a table that shares a
            // group with another table (even via a different group) conflicts with that group's
            // bookings too, because those bookings reserve the shared physical table. This is what
            // makes a group booking (TableId = null) visible: it's matched on its TableGroupId here.
            var reservedGroupIds = new HashSet<int>(
                await _db.TableGroupMemberships
                    .Where(m => reservedTableIds.Contains(m.TableId))
                    .Select(m => m.TableGroupId)
                    .Distinct()
                    .ToListAsync());

            if (tableGroupId.HasValue)
            {
                reservedGroupIds.Add(tableGroupId.Value);
            }

            return await _db.Bookings.AnyAsync(b =>
                !b.IsCancelled &&
                b.Date < newEnd &&
                (b.EndTime != null ? b.EndTime > newStart : b.Date > thresholdStart) &&
                ((b.TableId.HasValue && reservedTableIds.Contains(b.TableId.Value)) ||
                 (b.TableGroupId.HasValue && reservedGroupIds.Contains(b.TableGroupId.Value))));
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
                .Include(b => b.TableGroup)!
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.Table)
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
                .Include(b => b.TableGroup)!
                    .ThenInclude(g => g.Members)
                        .ThenInclude(m => m.Table)
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

        public async Task<int> CountFutureByTableAsync(int tableId, DateTime nowUtc)
        {
            return await _db.Bookings.CountAsync(b => b.TableId == tableId && !b.IsCancelled && b.Date >= nowUtc);
        }

        public async Task<int> CountFutureBySectionOrTablesAsync(int sectionId, IReadOnlyList<int> tableIds, DateTime nowUtc)
        {
            return await _db.Bookings.CountAsync(b =>
                !b.IsCancelled
                && b.Date >= nowUtc
                && (b.SectionId == sectionId || (b.TableId != null && tableIds.Contains(b.TableId.Value))));
        }

        public async Task<int> CountFutureByTableGroupsAsync(IReadOnlyList<int> tableGroupIds, DateTime nowUtc)
        {
            return await _db.Bookings.CountAsync(b =>
                !b.IsCancelled
                && b.Date >= nowUtc
                && b.TableGroupId != null
                && tableGroupIds.Contains(b.TableGroupId.Value));
        }

        public async Task<List<Booking>> GetByTableGroupAsync(int tableGroupId)
        {
            return await _db.Bookings.Where(b => b.TableGroupId == tableGroupId).ToListAsync();
        }
    }
}
