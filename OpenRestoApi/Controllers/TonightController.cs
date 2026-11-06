using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.RequireAdmin)]
public class TonightController(TonightService tonightService) : ControllerBase
{
    private readonly TonightService _tonight = tonightService;

    [HttpGet("api/admin/restaurants/{restaurantId:int}/tonight")]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read)]
    public async Task<IActionResult> Get(int restaurantId)
        => Ok(await _tonight.GetAsync(restaurantId));
}
