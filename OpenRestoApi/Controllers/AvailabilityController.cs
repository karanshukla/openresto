using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class AvailabilityController(AvailabilityService availabilityService) : ControllerBase
{
    private readonly AvailabilityService _availabilityService = availabilityService;

    [HttpGet("{restaurantId}")]
    public async Task<IActionResult> Get(int restaurantId, [FromQuery] DateTime date, [FromQuery] int seats)
    {
        try
        {
            AvailabilityResponseDto result = await _availabilityService.GetAvailabilityAsync(restaurantId, date, seats);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while checking availability.", detail = ex.Message });
        }
    }
}
