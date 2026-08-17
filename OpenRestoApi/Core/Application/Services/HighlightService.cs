using System.Globalization;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class HighlightService(IHighlightRepository highlightRepository, IAuditScope? audit = null)
{
    private readonly IHighlightRepository _highlightRepository = highlightRepository;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    private const int MaxTitleLength = 60;
    private const int MaxBodyLength = 500;

    public async Task<List<HighlightDto>> GetAllAsync()
    {
        List<RestaurantHighlight> items = await _highlightRepository.GetAllAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<HighlightDto> CreateAsync(CreateHighlightRequest req)
    {
        ValidateAndNormalize(
            req.Title, req.Body, req.IconKey, req.Link,
            out string title, out string body, out string iconKey, out string? link);
        var entity = new RestaurantHighlight
        {
            Title = title,
            Body = body,
            IconKey = iconKey,
            SortOrder = req.SortOrder,
            Link = link,
        };
        await _highlightRepository.AddAsync(entity);

        Describe(AuditActions.HighlightCreate, entity, $"Added the highlight \"{entity.Title}\"");
        return ToDto(entity);
    }

    public async Task<HighlightDto?> UpdateAsync(int id, UpdateHighlightRequest req)
    {
        RestaurantHighlight? entity = await _highlightRepository.FindByIdAsync(id);
        if (entity == null)
        {
            return null;
        }
        ValidateAndNormalize(
            req.Title, req.Body, req.IconKey, req.Link,
            out string title, out string body, out string iconKey, out string? link);
        _audit.RecordChange("title", entity.Title, title);
        _audit.RecordChange("body", entity.Body, body);
        _audit.RecordChange("iconKey", entity.IconKey, iconKey);
        _audit.RecordChange("sortOrder", entity.SortOrder, req.SortOrder);
        _audit.RecordChange("link", entity.Link, link);

        entity.Title = title;
        entity.Body = body;
        entity.IconKey = iconKey;
        entity.SortOrder = req.SortOrder;
        entity.Link = link;
        await _highlightRepository.SaveChangesAsync();

        Describe(AuditActions.HighlightUpdate, entity, $"Edited the highlight \"{entity.Title}\"");
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

        Describe(AuditActions.HighlightDelete, entity, $"Deleted the highlight \"{entity.Title}\"");
        return true;
    }

    private void Describe(string action, RestaurantHighlight entity, string summary)
        => _audit.Describe(action, AuditTargets.Highlight, entity.Id.ToString(CultureInfo.InvariantCulture), entity.Title,
            summary: summary);

    private static HighlightDto ToDto(RestaurantHighlight h) => new()
    {
        Id = h.Id,
        Title = h.Title,
        Body = h.Body,
        IconKey = h.IconKey,
        SortOrder = h.SortOrder,
        Link = h.Link,
    };

    /// <summary>
    /// Trims and validates the writable fields shared by create and update. Throws
    /// <see cref="ValidationException"/> (mapped to 400 by GlobalExceptionHandler) on any bad
    /// shape/value; on success assigns the normalized values to the out parameters. The link
    /// URL is optional — blank/whitespace clears to null (matching the brand-text convention),
    /// a non-blank value must be a valid absolute URL.
    /// </summary>
    private static void ValidateAndNormalize(
        string? rawTitle,
        string? rawBody,
        string? rawIconKey,
        string? rawLink,
        out string title,
        out string body,
        out string iconKey,
        out string? link)
    {
        title = (rawTitle ?? string.Empty).Trim();
        if (title.Length == 0)
        {
            throw new ValidationException("Highlight title cannot be empty.");
        }
        if (title.Length > MaxTitleLength)
        {
            throw new ValidationException($"Highlight title cannot exceed {MaxTitleLength} characters.");
        }

        body = (rawBody ?? string.Empty).Trim();
        if (body.Length > MaxBodyLength)
        {
            throw new ValidationException($"Highlight body cannot exceed {MaxBodyLength} characters.");
        }

        iconKey = (rawIconKey ?? string.Empty).Trim();
        if (!IoniconsAllowList.AllIcons.Contains(iconKey))
        {
            throw new ValidationException("Icon key must be one of the supported icons.");
        }

        link = NormalizeLink(rawLink);
    }

    /// <summary>
    /// Trims the link URL and treats blank/whitespace as null so empty inputs are stored
    /// consistently (matching the whitespace-to-null convention used for brand text fields).
    /// A non-blank value must parse as a valid absolute web/contact URL.
    /// </summary>
    private static string? NormalizeLink(string? link)
    {
        if (string.IsNullOrWhiteSpace(link))
        {
            return null;
        }

        string trimmed = link.Trim();
        if (!UrlValidator.IsValid(trimmed, UrlValidator.WebAndContactSchemes))
        {
            throw new ValidationException(
                "Highlight link must be a valid absolute URL (http, https, mailto, tel, or sms).");
        }
        return trimmed;
    }
}
