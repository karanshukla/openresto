using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AdminServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.NotificationServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingNotificationServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerRestoreTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerSectionsReorderTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerUpdateTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerEmailTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerLookupTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Integration.RepositoryTests")]
[ExternalAccessAllowed]
internal class TableRepository(AppDbContext db) : ITableRepository
{
    private readonly AppDbContext _db = db;

    public async Task<Table?> GetByIdAsync(int id)
    {
        return await _db.Tables.FindAsync(id);
    }

    // ── Bundle 2 additions ─────────────────────────────────────────────────────

    public async Task<Table?> FindByIdAsync(int id)
    {
        return await _db.Tables.FindAsync(id);
    }

    public async Task<Table?> GetWithSectionRestaurantAsync(int tableId, int sectionId)
    {
        return await _db.Tables
            .Include(t => t.Section)
                .ThenInclude(s => s!.Restaurant)
            .FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId);
    }

    public async Task<Table?> GetWithSectionForRestaurantAsync(int tableId, int restaurantId)
    {
        return await _db.Tables
            .Include(t => t.Section)
            .FirstOrDefaultAsync(t => t.Id == tableId && t.Section!.RestaurantId == restaurantId);
    }

    public async Task<int> CountByRestaurantAsync(int restaurantId)
    {
        return await _db.Tables.CountAsync(t => t.Section!.RestaurantId == restaurantId);
    }

    public async Task AddAsync(Table table)
    {
        _db.Tables.Add(table);
        await _db.SaveChangesAsync();
    }

    public void Remove(Table table)
    {
        _db.Tables.Remove(table);
    }

    public async Task<Table?> GetForRestaurantAsync(int tableId, int sectionId, int restaurantId)
    {
        return await _db.Tables
            .Include(t => t.Section)
            .FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId && t.Section!.RestaurantId == restaurantId);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
