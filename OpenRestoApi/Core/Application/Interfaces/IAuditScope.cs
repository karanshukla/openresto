namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// The audit entry being assembled for the current request. Every mutating admin request lands
/// a row whether or not anyone touches this — the middleware fills method, path, actor and
/// status code on its own. What this adds is a readable, domain-shaped description: a service
/// that has something meaningful to say about what it just did says it here, and the resulting
/// entry reads as <c>booking.cancel · ABC123</c> rather than <c>POST /api/admin/bookings/42/cancel</c>.
/// <para>
/// Scoped to the request. Injecting it is optional on every service that takes it, so a
/// unit test constructing the service by hand gets a no-op and needs no arrangement.
/// </para>
/// </summary>
public interface IAuditScope
{
    /// <summary>
    /// Names what this request did. The last call wins, so a service can describe an action
    /// and a later, more specific branch can refine it.
    /// </summary>
    void Describe(
        string action,
        string? targetType = null,
        string? targetId = null,
        string? targetLabel = null,
        int? restaurantId = null,
        string? summary = null);

    /// <summary>
    /// Records one field's before/after. Values are coerced to strings and masked when the field
    /// name is protected (credentials, customer identity — see <c>AuditFields.IsProtected</c>);
    /// an unchanged field is dropped rather than stored as a no-op diff.
    /// </summary>
    void RecordChange(string field, object? before, object? after);

    /// <summary>
    /// Attributes the entry to someone other than the request's claims — the login paths, where
    /// the actor is resolved by the service and there is no token yet (or never will be, on a
    /// failed attempt).
    /// </summary>
    void AttributeTo(int? userId, string email, string? displayName = null, string? role = null);
}
