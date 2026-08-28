using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// Owner-only management of admin API keys (issue #319 Phase 1), plus one exception: <see cref="Self"/>
/// (issue #319 Phase 2), reachable by any authenticated API key so a headless caller (the CLI's
/// <c>auth whoami</c>) can identify itself. The management actions each carry
/// <see cref="NoApiKeyAccessAttribute"/> directly — a key must never be usable to mint or revoke
/// keys, including its own — while <see cref="Self"/> carries <see cref="AllowAnyApiKeyAttribute"/>
/// and its own <see cref="AuthPolicies.RequireAdmin"/> gate (a Manager's key may introspect
/// itself even though only an Owner may manage keys). Attributes moved off the class level so the
/// two gates don't combine via <c>[Authorize]</c> AND-ing.
/// </summary>
[ApiController]
[Route("api/admin/api-keys")]
[EnableRateLimiting("auth")]
public class ApiKeysController(ApiKeyService apiKeys) : ControllerBase
{
    private readonly ApiKeyService _apiKeys = apiKeys;

    [HttpGet]
    [Authorize(Policy = AuthPolicies.RequireOwner)]
    [NoApiKeyAccess]
    public async Task<IActionResult> GetAll() => Ok(await _apiKeys.GetAllAsync());

    [HttpPost]
    [Authorize(Policy = AuthPolicies.RequireOwner)]
    [NoApiKeyAccess]
    public async Task<IActionResult> Create([FromBody] CreateApiKeyRequest req)
    {
        // ValidationException (missing name/scopes, invalid scope pair, past expiry) → 400,
        // mapped by GlobalExceptionHandler.
        ApiKeyCreatedDto created = await _apiKeys.CreateAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, created);
    }

    [HttpPost("{id:int}/revoke")]
    [Authorize(Policy = AuthPolicies.RequireOwner)]
    [NoApiKeyAccess]
    public async Task<IActionResult> Revoke(int id) => Ok(await _apiKeys.RevokeAsync(id));

    /// <summary>
    /// Key metadata only (id/name/prefix/scopes) plus the acting user's email/role — never the
    /// hash or secret. A JWT/browser session gets 400 rather than a lookup: it authenticated
    /// without a key, so there is nothing to introspect.
    /// </summary>
    [HttpGet("self")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [AllowAnyApiKey]
    public async Task<IActionResult> Self()
    {
        ApiKeySelfResult result = await _apiKeys.GetSelfAsync();
        return result.Status switch
        {
            ApiKeySelfStatus.NotAnApiKeySession => BadRequest(new MessageResponse
            {
                Message = "This endpoint requires an API key session; the caller authenticated some other way.",
                Code = ErrorCodes.ApiKeyNotASession,
            }),
            ApiKeySelfStatus.KeyNotFound => NotFound(),
            _ => Ok(result.Key),
        };
    }
}
