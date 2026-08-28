using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Controllers;

/// <summary>
/// Public, unauthenticated server version — lets a client (the CLI, issue #404) detect it's
/// talking to a server older or newer than itself. Same shape as <see cref="BrandController"/>'s
/// GET: no auth, the "public" rate-limit policy, read-only so it needs no audit noun.
/// </summary>
[ApiController]
[Route("api/version")]
[EnableRateLimiting("public")]
public class VersionController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new VersionResponse { Version = AppVersion.Current });
}

public class VersionResponse
{
    public string Version { get; set; } = string.Empty;
}
