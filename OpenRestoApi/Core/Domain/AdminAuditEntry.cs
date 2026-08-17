namespace OpenRestoApi.Core.Domain;

/// <summary>
/// One append-only record of a state-changing action taken through the admin API, plus
/// authentication events. Nothing in the application ever updates or deletes a row except the
/// retention pass — there is no write or delete endpoint, because an admin who can erase the
/// audit log has no audit log.
/// <para>
/// The actor and target fields are denormalized for the same reason
/// <see cref="AdminNotification"/>'s are: the entry has to stay readable after the booking is
/// purged, the location is deleted, or the actor renames themselves.
/// </para>
/// </summary>
public class AdminAuditEntry
{
    public int Id { get; set; }

    /// <summary>UTC, taken from <c>ISystemClock</c> so tests can control it.</summary>
    public DateTime OccurredAt { get; set; }

    // ── Actor ────────────────────────────────────────────────────────────────
    /// <summary>Null for failed logins and for unauthenticated self-service resets.</summary>
    public int? ActorUserId { get; set; }
    public AdminCredential? ActorUser { get; set; }

    /// <summary>
    /// The address the action was taken under. On a failed login this is the address that was
    /// attempted, which may match no account at all.
    /// </summary>
    public string ActorEmail { get; set; } = string.Empty;

    public string? ActorDisplayName { get; set; }

    /// <summary>The role held <em>at the time of the action</em>, not the role held now.</summary>
    public string ActorRole { get; set; } = string.Empty;

    // ── What happened ────────────────────────────────────────────────────────
    /// <summary>
    /// Dotted key from <c>AuditActions</c> — <c>booking.cancel</c>, <c>user.role_change</c>,
    /// <c>auth.login_failed</c>. Requests no service enriched fall back to <c>http.post</c>
    /// and friends.
    /// </summary>
    public string Action { get; set; } = string.Empty;

    public string? TargetType { get; set; }

    /// <summary>String rather than int so booking refs and numeric ids both fit.</summary>
    public string? TargetId { get; set; }

    public string? TargetLabel { get; set; }

    /// <summary>Filter axis. Null for global actions such as brand or user management.</summary>
    public int? RestaurantId { get; set; }

    public string? Summary { get; set; }

    /// <summary>
    /// Before/after values as <c>{"field":{"before":"…","after":"…"}}</c>. Written only through
    /// <c>IAuditScope.RecordChange</c>, so a field is present only because a service named it —
    /// an allow-list by construction. <c>AuditFields</c> masks the values of credential- and
    /// customer-identity fields on top of that.
    /// </summary>
    public string? ChangesJson { get; set; }

    // ── The floor the middleware always fills ────────────────────────────────
    public string HttpMethod { get; set; } = string.Empty;

    /// <summary>Path only — the query string is dropped, since admin filters carry customer emails.</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>Rejected attempts are audit-relevant, so 4xx rows are kept.</summary>
    public int StatusCode { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }
}
