namespace OpenRestoApi.Core.Application.DTOs;

// ── Current user (GET /admin/auth/me) ────────────────────────────────────────

/// <summary>
/// Identity of the signed-in caller. Deliberately additive-only: clients must ignore
/// unknown fields so a later <c>permissions</c> or <c>scopedRestaurantId</c> addition
/// doesn't break an older frontend build.
/// </summary>
public class CurrentUserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = null!;
}

// ── User management (Owner-only, /admin/users) ───────────────────────────────

public class UserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>True when this user has configured a security question for self-service reset.</summary>
    public bool HasSecurityQuestion { get; set; }
}

public class CreateUserRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = null!;
}

public class UpdateUserRoleRequest
{
    public string Role { get; set; } = null!;
}

public class SetUserActiveRequest
{
    public bool IsActive { get; set; }
}

public class ResetUserPasswordRequest
{
    public string NewPassword { get; set; } = null!;
}
