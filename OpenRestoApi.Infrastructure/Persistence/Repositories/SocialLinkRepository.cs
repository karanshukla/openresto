using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.SocialLinkServiceTests")]
[ExternalAccessAllowed]
internal class SocialLinkRepository(AppDbContext db) : ISocialLinkRepository
{
    private readonly AppDbContext _db = db;

    public async Task<List<SocialLink>> GetAllAsync()
    {
        return await _db.SocialLinks
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .ToListAsync();
    }

    public async Task<SocialLink?> FindByIdAsync(int id)
    {
        return await _db.SocialLinks.FindAsync(id);
    }

    public async Task<SocialLink> AddAsync(SocialLink link)
    {
        _db.SocialLinks.Add(link);
        await _db.SaveChangesAsync();
        return link;
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }

    public void Remove(SocialLink link)
    {
        _db.SocialLinks.Remove(link);
    }
}
