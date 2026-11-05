using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// The sites allowed to frame the booking widget. Owner-only, and not writable by an API key:
/// every origin added here is a site that can put the booking form inside its own page.
/// </summary>
[ApiController]
[Route("api/admin/embed-settings")]
[Authorize(Policy = AuthPolicies.RequireOwner)]
[EnableRateLimiting("public")]
public class EmbedSettingsController(EmbedSettingsService embedSettings) : ControllerBase
{
    private readonly EmbedSettingsService _embedSettings = embedSettings;

    // <seealso>EmbedSettingsControllerTests.Get_AsManager_Returns403</seealso>
    [HttpGet]
    [RequiresScope(ApiKeyScopes.Brand, ApiKeyScopes.Read)]
    public async Task<IActionResult> Get() => Ok(await _embedSettings.GetAsync());

    // <seealso>EmbedSettingsControllerTests.Update_WithABrandWriteKey_Returns403</seealso>
    [HttpPut]
    [NoApiKeyAccess]
    public async Task<IActionResult> Update([FromBody] UpdateEmbedSettingsRequest request)
        => Ok(await _embedSettings.UpdateAsync(request));
}
