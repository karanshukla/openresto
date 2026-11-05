using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/embed")]
[EnableRateLimiting("public")]
public class EmbedController(EmbedSettingsService embedSettings) : ControllerBase
{
    public const string FrameAncestorsHeader = "X-Frame-Ancestors";

    private readonly EmbedSettingsService _embedSettings = embedSettings;

    /// <summary>
    /// The <c>frame-ancestors</c> source list for the widget page, as a header on an empty
    /// response. nginx fetches it with <c>auth_request</c> on every <c>/embed</c> load and
    /// copies it into that page's Content-Security-Policy, so a change in settings applies to
    /// the next load without reloading nginx.
    /// <seealso>EmbedSettingsControllerTests.FrameAncestors_FollowsTheSavedOrigins</seealso>
    /// </summary>
    [HttpGet("frame-ancestors")]
    public async Task<IActionResult> FrameAncestors()
    {
        Response.Headers[FrameAncestorsHeader] = await _embedSettings.GetFrameAncestorsAsync();
        return NoContent();
    }
}
