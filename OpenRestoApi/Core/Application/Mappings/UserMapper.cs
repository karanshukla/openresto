using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Mappings;

/// <summary>
/// Projections of <see cref="AdminCredential"/> onto the two shapes that leave the API.
/// Neither ever carries the password hash/salt, the PVQ answer, or a reset token — a
/// single place to enforce that, shared by <c>AuthService</c> and <c>UserService</c>.
/// Hand-written rather than Mapperly-generated: both projections drop most of the source
/// and one derives a boolean, which is more attribute noise than mapping code.
/// </summary>
public static class UserMapper
{
    public static CurrentUserDto ToCurrentUserDto(AdminCredential user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Role = user.Role,
    };

    public static UserDto ToDto(AdminCredential user) => new()
    {
        Id = user.Id,
        Email = user.Email,
        DisplayName = user.DisplayName,
        Role = user.Role,
        IsActive = user.IsActive,
        CreatedAt = user.CreatedAt,
        HasSecurityQuestion = user.PvqQuestion != null,
    };
}
