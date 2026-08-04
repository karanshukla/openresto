using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.RestaurantManagementServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalkInTests")]
[ExternalAccessAllowed]
internal class TableGroupRepository(AppDbContext db) : ITableGroupRepository
{
    private readonly AppDbContext _db = db;

    public async Task<TableGroup?> GetByIdWithMembersAsync(int groupId, int restaurantId)
    {
        return await _db.TableGroups
            .Include(g => g.Members)
                .ThenInclude(m => m.Table)
            .FirstOrDefaultAsync(g => g.Id == groupId && g.RestaurantId == restaurantId);
    }

    public async Task<List<TableGroup>> GetAllWithMembersByRestaurantAsync(int restaurantId)
    {
        return await _db.TableGroups
            .Where(g => g.RestaurantId == restaurantId)
            .Include(g => g.Members)
                .ThenInclude(m => m.Table)
            .OrderBy(g => g.Id)
            .ToListAsync();
    }

    public async Task AddAsync(TableGroup group)
    {
        _db.TableGroups.Add(group);
        await _db.SaveChangesAsync();
    }

    public void Remove(TableGroup group)
    {
        _db.TableGroups.Remove(group);
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
