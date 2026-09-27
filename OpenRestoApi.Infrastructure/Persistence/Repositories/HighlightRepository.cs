using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.HighlightServiceTests")]
[ExternalAccessAllowed]
internal class HighlightRepository(AppDbContext db) : IHighlightRepository
{
    private readonly AppDbContext _db = db;

    public async Task<List<RestaurantHighlight>> GetAllAsync()
    {
        return await _db.Highlights
            .OrderBy(h => h.SortOrder)
            .ThenBy(h => h.Id)
            .ToListAsync();
    }

    public async Task<RestaurantHighlight?> FindByIdAsync(int id)
    {
        return await _db.Highlights.FindAsync(id);
    }

    public async Task<RestaurantHighlight> AddAsync(RestaurantHighlight highlight)
    {
        _db.Highlights.Add(highlight);
        await _db.SaveChangesAsync();
        return highlight;
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }

    public void Remove(RestaurantHighlight highlight)
    {
        _db.Highlights.Remove(highlight);
    }
}
