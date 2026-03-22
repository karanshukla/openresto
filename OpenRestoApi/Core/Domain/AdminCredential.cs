namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Single-row table that stores the admin's hashed credentials and PVQ.
/// Bootstrapped from appsettings on first login; subsequent logins use this row.
/// </summary>
public class AdminCredential
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string PasswordSalt { get; set; } = null!;

    // ── Personal Verification Question ──────────────────────────────────────
    public string? PvqQuestion { get; set; }
    public string? PvqAnswerHash { get; set; }
    public string? PvqAnswerSalt { get; set; }

    // ── Password reset ───────────────────────────────────────────────────────
    public string? ResetToken { get; set; }
    public DateTime? ResetTokenExpiry { get; set; }
}
