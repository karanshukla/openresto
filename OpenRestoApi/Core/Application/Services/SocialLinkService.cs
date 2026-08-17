using System.Globalization;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class SocialLinkService(ISocialLinkRepository socialLinkRepository, IAuditScope? audit = null)
{
    private readonly ISocialLinkRepository _socialLinkRepository = socialLinkRepository;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    private const int MaxLabelLength = 60;

    public async Task<List<SocialLinkDto>> GetAllAsync()
    {
        List<SocialLink> items = await _socialLinkRepository.GetAllAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<SocialLinkDto> CreateAsync(CreateSocialLinkRequest req)
    {
        ValidateAndNormalize(req.Label, req.Url, req.IconKey, out string label, out string url, out string iconKey);
        var entity = new SocialLink
        {
            Label = label,
            Url = url,
            IconKey = iconKey,
            SortOrder = req.SortOrder,
        };
        await _socialLinkRepository.AddAsync(entity);

        Describe(AuditActions.SocialLinkCreate, entity, $"Added the social link \"{entity.Label}\"");
        return ToDto(entity);
    }

    public async Task<SocialLinkDto?> UpdateAsync(int id, UpdateSocialLinkRequest req)
    {
        SocialLink? entity = await _socialLinkRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return null;
        }
        ValidateAndNormalize(req.Label, req.Url, req.IconKey, out string label, out string url, out string iconKey);
        _audit.RecordChange("label", entity.Label, label);
        _audit.RecordChange("url", entity.Url, url);
        _audit.RecordChange("iconKey", entity.IconKey, iconKey);
        _audit.RecordChange("sortOrder", entity.SortOrder, req.SortOrder);

        entity.Label = label;
        entity.Url = url;
        entity.IconKey = iconKey;
        entity.SortOrder = req.SortOrder;
        await _socialLinkRepository.SaveChangesAsync();

        Describe(AuditActions.SocialLinkUpdate, entity, $"Edited the social link \"{entity.Label}\"");
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

        Describe(AuditActions.SocialLinkDelete, entity, $"Deleted the social link \"{entity.Label}\"");
        return true;
    }

    private void Describe(string action, SocialLink entity, string summary)
        => _audit.Describe(action, AuditTargets.SocialLink, entity.Id.ToString(CultureInfo.InvariantCulture), entity.Label,
            summary: summary);

    private static SocialLinkDto ToDto(SocialLink s) => new()
    {
        Id = s.Id,
        Label = s.Label,
        Url = s.Url,
        IconKey = s.IconKey,
        SortOrder = s.SortOrder,
    };

    /// <summary>
    /// Trims and validates the writable fields shared by create and update. Throws
    /// <see cref="ValidationException"/> (mapped to 400 by GlobalExceptionHandler) on any bad
    /// shape/value; on success assigns the normalized values to the out parameters.
    /// </summary>
    private static void ValidateAndNormalize(
        string? rawLabel,
        string? rawUrl,
        string? rawIconKey,
        out string label,
        out string url,
        out string iconKey)
    {
        label = (rawLabel ?? string.Empty).Trim();
        if (label.Length == 0)
        {
            throw new ValidationException("Social link label cannot be empty.");
        }
        if (label.Length > MaxLabelLength)
        {
            throw new ValidationException($"Social link label cannot exceed {MaxLabelLength} characters.");
        }

        url = (rawUrl ?? string.Empty).Trim();
        if (url.Length == 0)
        {
            throw new ValidationException("Social link URL cannot be empty.");
        }
        if (!UrlValidator.IsValid(url, UrlValidator.WebAndContactSchemes))
        {
            throw new ValidationException(
                "Social link URL must be a valid absolute URL (http, https, mailto, tel, or sms).");
        }

        iconKey = (rawIconKey ?? string.Empty).Trim();
        if (!IoniconsAllowList.AllIcons.Contains(iconKey))
        {
            throw new ValidationException("Icon key must be one of the supported icons.");
        }
    }
}
