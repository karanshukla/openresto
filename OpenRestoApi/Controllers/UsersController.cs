using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// Owner-only management of admin accounts. Gated once at the class level by the
/// <see cref="AuthPolicies.RequireOwner"/> policy; the service below assumes authorization
/// has already happened and only enforces business rules.
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = AuthPolicies.RequireOwner)]
[EnableRateLimiting("auth")]
public class UsersController(UserService users) : ControllerBase
{
    private readonly UserService _users = users;

    [HttpGet]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Read)]
    public async Task<IActionResult> GetAll() => Ok(await _users.GetAllAsync());

    [HttpPost]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        // ValidationException (bad email/password/role) and BusinessRuleException (duplicate
        // email) → 400 are mapped by GlobalExceptionHandler.
        UserDto created = await _users.CreateAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, created);
    }

    [HttpPatch("{id:int}/role")]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateUserRoleRequest req)
        => Ok(await _users.UpdateRoleAsync(id, req));

    [HttpPatch("{id:int}/active")]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public async Task<IActionResult> SetActive(int id, [FromBody] SetUserActiveRequest req)
        => Ok(await _users.SetActiveAsync(id, req));

    [HttpPost("{id:int}/reset-password")]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetUserPasswordRequest req)
        => Ok(await _users.ResetPasswordAsync(id, req));
}
