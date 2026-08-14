namespace OpenRestoApi.Core.Domain;

/// <summary>
/// An admin user account: login email, hashed password, PVQ reset question, and role.
/// Historically a single-row table (one admin per instance); it now holds one row per user,
/// with <see cref="Role"/> deciding what each may do. The table name stays
/// <c>AdminCredentials</c> so the multi-user migration is purely additive.
/// </summary>
public class AdminCredential
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string PasswordSalt { get; set; } = null!;

    // ── Identity & access ────────────────────────────────────────────────────
    /// <summary>Optional human name shown in the UI; falls back to <see cref="Email"/>.</summary>
    public string? DisplayName { get; set; }

    /// <summary>One of <see cref="Core.Application.Utilities.UserRoles.Assignable"/>.</summary>
    public string Role { get; set; } = Core.Application.Utilities.UserRoles.Owner;

    /// <summary>
    /// Deactivated users keep their row (so any future audit trail keeps resolving) but
    /// cannot log in.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ── Personal Verification Question ──────────────────────────────────────
    public string? PvqQuestion { get; set; }
    public string? PvqAnswerHash { get; set; }
    public string? PvqAnswerSalt { get; set; }

    // ── Password reset ───────────────────────────────────────────────────────
    public string? ResetToken { get; set; }
    public DateTime? ResetTokenExpiry { get; set; }
}
