using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AdminServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerRestoreTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerSectionsReorderTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerUpdateTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerEmailTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Controllers.AdminControllerLookupTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Integration.RepositoryTests")]
[ExternalAccessAllowed]
internal class SectionRepository(AppDbContext db) : ISectionRepository
{
    private readonly AppDbContext _db = db;

    public async Task<Section?> GetByIdAsync(int id)
    {
        return await _db.Sections.FindAsync(id);
    }

    // ── Bundle 2 additions ─────────────────────────────────────────────────────

    public async Task<Section?> FindByIdAsync(int id)
    {
        return await _db.Sections.FindAsync(id);
    }

    public async Task<List<Section>> GetByRestaurantAsync(int restaurantId)
    {
        return await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .ToListAsync();
    }

    public async Task<List<Section>> GetByRestaurantAsync(int restaurantId, bool includeTables)
    {
        IQueryable<Section> q = _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id);

        if (includeTables)
        {
            q = q.Include(s => s.Tables);
        }

        return await q.ToListAsync();
    }

    public async Task<int> CountByRestaurantAsync(int restaurantId)
    {
        return await _db.Sections.CountAsync(s => s.RestaurantId == restaurantId);
    }

    public async Task<bool?> ReorderAsync(int restaurantId, IReadOnlyList<int> sectionIds)
    {
        bool restaurantExists = await _db.Restaurants.AnyAsync(r => r.Id == restaurantId);
        if (!restaurantExists)
        {
            return null;
        }

        if (sectionIds == null)
        {
            return false;
        }

        List<Section> sections = await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .ToListAsync();

        if (sectionIds.Count != sections.Count ||
            sectionIds.Distinct().Count() != sectionIds.Count)
        {
            return false;
        }

        Dictionary<int, Section> sectionsById = sections.ToDictionary(s => s.Id);
        if (sectionIds.Any(id => !sectionsById.ContainsKey(id)))
        {
            return false;
        }

        for (int i = 0; i < sectionIds.Count; i++)
        {
            sectionsById[sectionIds[i]].SortOrder = i;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task AddAsync(Section section)
    {
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();
    }

    public void Remove(Section section)
    {
        _db.Sections.Remove(section);
    }

    public async Task<Section?> FindForRestaurantAsync(int sectionId, int restaurantId)
    {
        return await _db.Sections
            .FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == restaurantId);
    }

    public async Task<Section?> GetWithTablesForRestaurantAsync(int sectionId, int restaurantId)
    {
        return await _db.Sections
            .Include(s => s.Tables)
            .FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == restaurantId);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
