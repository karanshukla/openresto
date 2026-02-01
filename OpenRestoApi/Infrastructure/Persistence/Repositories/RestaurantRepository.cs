using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

public class RestaurantRepository : IRestaurantRepository
{
    private readonly AppDbContext _db;

    public RestaurantRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Restaurant?> GetByIdAsync(int id)
    {
        return await _db.Restaurants
            .Include(r => r.Sections)
            .ThenInclude(s => s.Tables)
            .FirstOrDefaultAsync(r => r.Id == id);
    }
}
