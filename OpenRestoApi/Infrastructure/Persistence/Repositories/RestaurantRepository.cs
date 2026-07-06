using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AvailabilityServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AdminServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.HoldPolicyServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.MediaServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerRestoreTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerSectionsReorderTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerUpdateTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerEmailTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerLookupTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Integration.RepositoryTests")]
[ExternalAccessAllowed]
internal class RestaurantRepository(AppDbContext db) : IRestaurantRepository
{
    private readonly AppDbContext _db = db;

    public async Task<Restaurant?> GetByIdAsync(int id)
    {
        return await _db.Restaurants
            .Include(r => r.Sections)
            .ThenInclude(s => s.Tables)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsArchived);
    }

    // ── Bundle 2 additions ─────────────────────────────────────────────────────

    public async Task<Restaurant?> FindByIdAsync(int id)
    {
        return await _db.Restaurants.FindAsync(id);
    }

    public async Task<List<Restaurant>> GetAllActiveAsync()
    {
        return await _db.Restaurants.Where(r => !r.IsArchived).ToListAsync();
    }

    public async Task<List<Restaurant>> GetAllActiveWithSectionsAsync()
    {
        return await _db.Restaurants
            .Where(r => !r.IsArchived)
            .Include(r => r.Sections)
                .ThenInclude(s => s.Tables)
            .ToListAsync();
    }

    public async Task<Restaurant> AddAsync(Restaurant restaurant)
    {
        _db.Restaurants.Add(restaurant);
        await _db.SaveChangesAsync();
        return restaurant;
    }

    public void Remove(Restaurant restaurant)
    {
        _db.Restaurants.Remove(restaurant);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _db.Restaurants.AnyAsync(r => r.Id == id);
    }

    public async Task<List<LookupDto>> GetAllWithActiveBookingsCountAsync(DateTime nowUtc)
    {
        return await _db.Restaurants
            .OrderBy(r => r.Name)
            .Select(r => new LookupDto
            {
                Id = r.Id,
                Name = r.Name,
                BookingsPausedUntil = r.BookingsPausedUntil,
                IsArchived = r.IsArchived,
                ActiveBookingsCount = _db.Bookings.Count(b =>
                    b.RestaurantId == r.Id &&
                    !b.IsCancelled &&
                    b.Date <= nowUtc &&
                    (b.EndTime.HasValue ? b.EndTime.Value > nowUtc : b.Date.AddMinutes(r.DefaultBookingDurationMinutes) > nowUtc))
            })
            .ToListAsync();
    }
}
