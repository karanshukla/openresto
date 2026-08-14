using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/highlights")]
[EnableRateLimiting("public")]
public class HighlightsController(HighlightService highlightService) : ControllerBase
{
    private readonly HighlightService _highlights = highlightService;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _highlights.GetAllAsync();
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> Create([FromBody] CreateHighlightRequest req)
    {
        var dto = await _highlights.CreateAsync(req);
        return CreatedAtAction(nameof(GetAll), new { }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateHighlightRequest req)
    {
        var dto = await _highlights.UpdateAsync(id, req);
        if (dto == null)
        {
            return NotFound();
        }

        return Ok(dto);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> Delete(int id)
    {
        bool deleted = await _highlights.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}
