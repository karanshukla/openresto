using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// The deployment state a self-hoster's native guest app build depends on (issue #388): whether
/// this instance is reachable the way the stores require, and which builds are calling it.
/// Read-only, and scoped as brand state rather than a resource of its own — everything it reads
/// is either brand configuration or an aggregate counter, and nothing here is writable.
/// </summary>
[ApiController]
[Route("api/admin/native-app")]
[Authorize(Policy = AuthPolicies.RequireAdmin)]
[RequiresScope(ApiKeyScopes.Brand, ApiKeyScopes.Read)]
[EnableRateLimiting("public")]
public class NativeAppController(NativeAppStatusService statusService) : ControllerBase
{
    private readonly NativeAppStatusService _status = statusService;

    /// <summary>
    /// The readiness checklist, the configured minimum app version, and aggregate use per native
    /// build. Read-only: nothing here mutates the deployment.
    /// <seealso>NativeAppControllerTests.Status_WithoutAuth_Returns401</seealso>
    /// <seealso>NativeAppControllerTests.Status_WithAdminJwt_ReturnsTheFiveChecks</seealso>
    /// <seealso>NativeAppControllerTests.Status_WithABookingsOnlyKey_Returns403</seealso>
    /// <seealso>NativeAppControllerTests.Status_WithABrandReadKey_Returns200</seealso>
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        NativeAppStatusResponse status = await _status.GetStatusAsync(cancellationToken);
        return Ok(status);
    }
}
