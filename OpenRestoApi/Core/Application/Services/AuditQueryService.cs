using System.Text.Json;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The read side of the audit trail. Paging bounds match the notification history's
/// (<c>pageSize</c> clamped 1–100) so both admin list screens behave the same.
/// </summary>
public class AuditQueryService(IAdminAuditRepository repository)
{
    public const int MinPageSize = 1;
    public const int MaxPageSize = 100;

    private readonly IAdminAuditRepository _repository = repository;

    public async Task<(List<AdminAuditEntryDto> Items, int TotalCount)> GetEntriesAsync(
        AuditQuery query, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, MinPageSize, MaxPageSize);

        (List<AdminAuditEntry> entries, int total) = await _repository.QueryPagedAsync(query, page, pageSize);
        return (entries.Select(ToDto).ToList(), total);
    }

    private static AdminAuditEntryDto ToDto(AdminAuditEntry e) => new()
    {
        Id = e.Id,
        OccurredAt = e.OccurredAt,
        ActorUserId = e.ActorUserId,
        ActorEmail = e.ActorEmail,
        ActorDisplayName = e.ActorDisplayName,
        ActorRole = e.ActorRole,
        Action = e.Action,
        TargetType = e.TargetType,
        TargetId = e.TargetId,
        TargetLabel = e.TargetLabel,
        RestaurantId = e.RestaurantId,
        Summary = e.Summary,
        Changes = ParseChanges(e.ChangesJson),
        HttpMethod = e.HttpMethod,
        Path = e.Path,
        StatusCode = e.StatusCode,
        IpAddress = e.IpAddress,
        UserAgent = e.UserAgent,
    };

    /// <summary>
    /// A row whose JSON can't be read still renders — the diff is the enrichment, not the record,
    /// and dropping the whole entry over it would lose the actor and action too.
    /// </summary>
    private static List<AuditChangeDto> ParseChanges(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];

        Dictionary<string, AuditChange>? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<Dictionary<string, AuditChange>>(json, AuditChange.JsonOptions);
        }
        catch (JsonException)
        {
            return [];
        }

        if (parsed is null) return [];

        return parsed
            .Select(kv => new AuditChangeDto { Field = kv.Key, Before = kv.Value.Before, After = kv.Value.After })
            .ToList();
    }
}
