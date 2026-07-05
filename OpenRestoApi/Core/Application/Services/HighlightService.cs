using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class HighlightService(IHighlightRepository highlightRepository)
{
    private readonly IHighlightRepository _highlightRepository = highlightRepository;

    public async Task<List<HighlightDto>> GetAllAsync()
    {
        List<RestaurantHighlight> items = await _highlightRepository.GetAllAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<HighlightDto> CreateAsync(CreateHighlightRequest req)
    {
        var entity = new RestaurantHighlight
        {
            Title = req.Title,
            Body = req.Body,
            IconKey = req.IconKey,
            SortOrder = req.SortOrder,
        };
        await _highlightRepository.AddAsync(entity);
        return ToDto(entity);
    }

    public async Task<HighlightDto?> UpdateAsync(int id, UpdateHighlightRequest req)
    {
        RestaurantHighlight? entity = await _highlightRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return null;
        }
        entity.Title = req.Title;
        entity.Body = req.Body;
        entity.IconKey = req.IconKey;
        entity.SortOrder = req.SortOrder;
        await _highlightRepository.SaveChangesAsync();
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        RestaurantHighlight? entity = await _highlightRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return false;
        }
        _highlightRepository.Remove(entity);
        await _highlightRepository.SaveChangesAsync();
        return true;
    }

    private static HighlightDto ToDto(RestaurantHighlight h) => new()
    {
        Id = h.Id,
        Title = h.Title,
        Body = h.Body,
        IconKey = h.IconKey,
        SortOrder = h.SortOrder,
    };
}
