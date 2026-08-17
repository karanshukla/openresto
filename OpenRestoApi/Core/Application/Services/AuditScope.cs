using System.Text.Json;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>One field's before/after, as stored inside <c>ChangesJson</c>.</summary>
public sealed record AuditChange(string? Before, string? After)
{
    /// <summary>Shared by the write and read sides so the stored JSON round-trips.</summary>
    public static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
}

/// <inheritdoc cref="IAuditScope" />
public sealed class AuditScope : IAuditScope
{
    private Dictionary<string, AuditChange>? _changes;

    public string? Action { get; private set; }
    public string? TargetType { get; private set; }
    public string? TargetId { get; private set; }
    public string? TargetLabel { get; private set; }
    public int? RestaurantId { get; private set; }
    public string? Summary { get; private set; }

    public int? ActorUserId { get; private set; }
    public string? ActorEmail { get; private set; }
    public string? ActorDisplayName { get; private set; }
    public string? ActorRole { get; private set; }

    /// <summary>
    /// True once a service has named the action. The middleware writes a row for any described
    /// request even when it wasn't a mutating admin call — which is how a failed login, arriving
    /// with no token at all, still gets recorded.
    /// </summary>
    public bool IsDescribed => Action is not null;

    /// <summary>True once a service has named the actor explicitly, overriding the request claims.</summary>
    public bool HasExplicitActor => ActorEmail is not null;

    public void Describe(
        string action,
        string? targetType = null,
        string? targetId = null,
        string? targetLabel = null,
        int? restaurantId = null,
        string? summary = null)
    {
        Action = action;
        TargetType = targetType ?? TargetType;
        TargetId = targetId ?? TargetId;
        TargetLabel = targetLabel ?? TargetLabel;
        RestaurantId = restaurantId ?? RestaurantId;
        Summary = summary ?? Summary;
    }

    /// <summary>
    /// The equality check runs on the raw values, before redaction: two different passwords both
    /// mask to <see cref="AuditFields.RedactedMarker"/>, and dropping them as equal would lose the
    /// one thing the entry is allowed to say about them.
    /// <seealso>AuditScopeTests.RecordChange_RecordsThatAProtectedFieldChanged_ButNotItsValues</seealso>
    /// <seealso>AuditScopeTests.RecordChange_DropsFieldsThatDidNotChange</seealso>
    /// </summary>
    public void RecordChange(string field, object? before, object? after)
    {
        if (Equals(before, after)) return;

        _changes ??= [];
        _changes[field] = new AuditChange(AuditFields.Redact(field, before), AuditFields.Redact(field, after));
    }

    public void AttributeTo(int? userId, string email, string? displayName = null, string? role = null)
    {
        ActorUserId = userId;
        ActorEmail = email;
        ActorDisplayName = displayName;
        ActorRole = role;
    }

    /// <summary>
    /// The recorded diff as it goes into the column, or null when nothing changed. Over-long
    /// payloads are dropped rather than clipped — half a JSON document is worse than none, since
    /// the read side would fail to parse it and lose the whole diff anyway.
    /// <seealso>AuditScopeTests.ChangesJson_IsDroppedRatherThanClippedWhenItExceedsTheColumn</seealso>
    /// <seealso>AuditScopeTests.ChangesJson_IsKeptWhenItFitsTheColumn</seealso>
    /// </summary>
    public string? ChangesJson()
    {
        if (_changes is null || _changes.Count == 0) return null;
        string json = JsonSerializer.Serialize(_changes, AuditChange.JsonOptions);
        return json.Length <= AuditFields.MaxChangesJsonLength ? json : null;
    }
}

/// <summary>
/// The no-op every service falls back to when no scope was injected — a hand-constructed
/// service in a unit test, or any code path running outside a request.
/// </summary>
public sealed class NullAuditScope : IAuditScope
{
    public static readonly IAuditScope Instance = new NullAuditScope();

    private NullAuditScope() { }

    public void Describe(string action, string? targetType = null, string? targetId = null,
        string? targetLabel = null, int? restaurantId = null, string? summary = null)
    { }

    public void RecordChange(string field, object? before, object? after) { }

    public void AttributeTo(int? userId, string email, string? displayName = null, string? role = null) { }
}
