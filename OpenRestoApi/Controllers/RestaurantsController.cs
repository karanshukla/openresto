using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class RestaurantsController(RestaurantManagementService service) : ControllerBase
{
    private readonly RestaurantManagementService _service = service;

    [HttpGet]
    public async Task<IActionResult> Get()
        => Ok(await _service.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        RestaurantDto? result = await _service.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Post(RestaurantDto dto)
    {
        RestaurantDto created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Put(int id, UpdateRestaurantRequest req)
    {
        // ValidationException (bad DefaultBookingDurationMinutes) → 400 is mapped
        // by GlobalExceptionHandler.
        RestaurantDto? result = await _service.UpdateAsync(id, req);
        return result == null ? NotFound() : Ok(result);
    }

    // ── Sections ────────────────────────────────────────────────────────────

    [HttpPost("{id}/sections")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddSection(int id, CreateSectionRequest req)
    {
        SectionDto? result = await _service.AddSectionAsync(id, req.Name);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/sections/{sectionId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSection(int id, int sectionId, UpdateSectionRequest req)
    {
        SectionDto? result = await _service.UpdateSectionAsync(id, sectionId, req.Name);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}/sections/{sectionId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSection(int id, int sectionId)
        => await _service.DeleteSectionAsync(id, sectionId) ? NoContent() : NotFound();

    // ── Tables ──────────────────────────────────────────────────────────────

    [HttpPost("{id}/sections/{sectionId}/tables")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddTable(int id, int sectionId, CreateTableRequest req)
    {
        TableDto? result = await _service.AddTableAsync(id, sectionId, req.Name, req.Seats);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateTable(int id, int sectionId, int tableId, UpdateTableRequest req)
    {
        TableDto? result = await _service.UpdateTableAsync(id, sectionId, tableId, req.Name, req.Seats);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTable(int id, int sectionId, int tableId)
        => await _service.DeleteTableAsync(id, sectionId, tableId) ? NoContent() : NotFound();
}
