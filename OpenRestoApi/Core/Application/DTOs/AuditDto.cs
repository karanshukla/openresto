namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// The filters <c>GET /api/admin/audit</c> accepts. <see cref="Action"/> matches by prefix, so
/// <c>booking</c> selects every <c>booking.*</c> key and <c>booking.cancel</c> selects just one.
/// </summary>
public class AuditQuery
{
    public int? ActorUserId { get; set; }
    public string? Action { get; set; }
    public string? TargetType { get; set; }
    public int? RestaurantId { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public class AuditChangeDto
{
    public string Field { get; set; } = string.Empty;
    public string? Before { get; set; }
    public string? After { get; set; }
}

public class AdminAuditEntryDto
{
    public int Id { get; set; }
    public DateTime OccurredAt { get; set; }

    public int? ActorUserId { get; set; }
    public string ActorEmail { get; set; } = string.Empty;
    public string? ActorDisplayName { get; set; }
    public string ActorRole { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public string? TargetLabel { get; set; }
    public int? RestaurantId { get; set; }
    public string? Summary { get; set; }

    /// <summary>Parsed out of the stored JSON so the client never has to deserialize a string field.</summary>
    public List<AuditChangeDto> Changes { get; set; } = [];

    public string HttpMethod { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
