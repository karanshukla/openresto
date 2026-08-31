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
/// <para>
/// The three actions that hand out or move interactive privilege — creating an account with a
/// caller-chosen password, resetting one, and changing a role — are <see cref="NoApiKeyAccessAttribute"/>
/// rather than scoped. A key that could mint a login would be a privilege-escalation primitive:
/// its holder logs into the admin UI as that account and reaches everything keys are excluded
/// from, including minting unscoped keys and rewriting the SMTP host/username/password that
/// <see cref="ApiKeyScopes"/> calls out as a mail-interception primitive. Restricting the role a
/// key may create is not a fix — <c>EmailSettingsController</c> is gated on
/// <see cref="AuthPolicies.RequireAdmin"/>, so a Manager login defeats the boundary just as well
/// as an Owner one. Reads and deactivation stay scoped: listing accounts, and shutting a
/// compromised one off, grant no session and are genuine automation.
/// </para>
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = AuthPolicies.RequireOwner)]
[EnableRateLimiting("auth")]
public class UsersController(UserService users) : ControllerBase
{
    private readonly UserService _users = users;

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>ApiKeyAuthTests.UsersReadKey_CanStillListAccounts</seealso>
    [HttpGet]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Read)]
    public async Task<IActionResult> GetAll() => Ok(await _users.GetAllAsync());

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>ApiKeyAuthTests.UsersWriteKey_CannotCreateAnAccount</seealso>
    [HttpPost]
    [NoApiKeyAccess]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        // ValidationException (bad email/password/role) and BusinessRuleException (duplicate
        // email) → 400 are mapped by GlobalExceptionHandler.
        UserDto created = await _users.CreateAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, created);
    }

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>ApiKeyAuthTests.UsersWriteKey_CannotChangeARole</seealso>
    [HttpPatch("{id:int}/role")]
    [NoApiKeyAccess]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateUserRoleRequest req)
        => Ok(await _users.UpdateRoleAsync(id, req));

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>ApiKeyAuthTests.UsersWriteKey_CanStillDeactivateAnAccount</seealso>
    [HttpPatch("{id:int}/active")]
    [RequiresScope(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public async Task<IActionResult> SetActive(int id, [FromBody] SetUserActiveRequest req)
        => Ok(await _users.SetActiveAsync(id, req));

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>ApiKeyAuthTests.UsersWriteKey_CannotResetAPassword</seealso>
    [HttpPost("{id:int}/reset-password")]
    [NoApiKeyAccess]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetUserPasswordRequest req)
        => Ok(await _users.ResetPasswordAsync(id, req));
}
