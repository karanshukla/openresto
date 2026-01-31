using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

public class TableRepository : ITableRepository
{
    private readonly AppDbContext _db;

    public TableRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Table?> GetByIdAsync(int id)
    {
        return await _db.Tables.FindAsync(id);
    }
}
