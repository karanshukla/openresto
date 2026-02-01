using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

public class SectionRepository : ISectionRepository
{
    private readonly AppDbContext _db;

    public SectionRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Section?> GetByIdAsync(int id)
    {
        return await _db.Sections.FindAsync(id);
    }
}
