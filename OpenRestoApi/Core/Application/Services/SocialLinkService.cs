using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class SocialLinkService(AppDbContext db)
{
    private readonly AppDbContext _db = db;

    public async Task<List<SocialLinkDto>> GetAllAsync()
    {
        List<SocialLink> items = await _db.SocialLinks
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .ToListAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<SocialLinkDto> CreateAsync(CreateSocialLinkRequest req)
    {
        var entity = new SocialLink
        {
            Label = req.Label,
            Url = req.Url,
            IconKey = req.IconKey,
            SortOrder = req.SortOrder,
        };
        _db.SocialLinks.Add(entity);
        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<SocialLinkDto?> UpdateAsync(int id, UpdateSocialLinkRequest req)
    {
        SocialLink? entity = await _db.SocialLinks.FindAsync(id);
        if (entity == null)
        {
            return null;
        }
        entity.Label = req.Label;
        entity.Url = req.Url;
        entity.IconKey = req.IconKey;
        entity.SortOrder = req.SortOrder;
        await _db.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        SocialLink? entity = await _db.SocialLinks.FindAsync(id);
        if (entity == null)
        {
            return false;
        }
        _db.SocialLinks.Remove(entity);
        await _db.SaveChangesAsync();
        return true;
    }

    private static SocialLinkDto ToDto(SocialLink s) => new()
    {
        Id = s.Id,
        Label = s.Label,
        Url = s.Url,
        IconKey = s.IconKey,
        SortOrder = s.SortOrder,
    };
}
