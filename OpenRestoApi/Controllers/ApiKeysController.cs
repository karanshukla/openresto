using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// Owner-only management of admin API keys (issue #319 Phase 1). Gated by
/// <see cref="AuthPolicies.RequireOwner"/> like <see cref="UsersController"/>, and additionally
/// carries <see cref="NoApiKeyAccessAttribute"/>: a key must never be usable to mint or revoke
/// keys, including its own.
/// </summary>
[ApiController]
[Route("api/admin/api-keys")]
[Authorize(Policy = AuthPolicies.RequireOwner)]
[NoApiKeyAccess]
[EnableRateLimiting("auth")]
public class ApiKeysController(ApiKeyService apiKeys) : ControllerBase
{
    private readonly ApiKeyService _apiKeys = apiKeys;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _apiKeys.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateApiKeyRequest req)
    {
        // ValidationException (missing name/scopes, invalid scope pair, past expiry) → 400,
        // mapped by GlobalExceptionHandler.
        ApiKeyCreatedDto created = await _apiKeys.CreateAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, created);
    }

    [HttpPost("{id:int}/revoke")]
    public async Task<IActionResult> Revoke(int id) => Ok(await _apiKeys.RevokeAsync(id));
}
