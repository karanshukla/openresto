using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class SocialLinkService(ISocialLinkRepository socialLinkRepository)
{
    private readonly ISocialLinkRepository _socialLinkRepository = socialLinkRepository;

    public async Task<List<SocialLinkDto>> GetAllAsync()
    {
        List<SocialLink> items = await _socialLinkRepository.GetAllAsync();
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
        await _socialLinkRepository.AddAsync(entity);
        return ToDto(entity);
    }

    public async Task<SocialLinkDto?> UpdateAsync(int id, UpdateSocialLinkRequest req)
    {
        SocialLink? entity = await _socialLinkRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return null;
        }
        entity.Label = req.Label;
        entity.Url = req.Url;
        entity.IconKey = req.IconKey;
        entity.SortOrder = req.SortOrder;
        await _socialLinkRepository.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        SocialLink? entity = await _socialLinkRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return false;
        }
        _socialLinkRepository.Remove(entity);
        await _socialLinkRepository.SaveChangesAsync();
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
