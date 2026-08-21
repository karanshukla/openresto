using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

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
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> Post(RestaurantDto dto)
    {
        RestaurantDto created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> Put(int id, UpdateRestaurantRequest req)
    {
        // ValidationException (bad DefaultBookingDurationMinutes) → 400 is mapped
        // by GlobalExceptionHandler.
        RestaurantDto? result = await _service.UpdateAsync(id, req);
        return result == null ? NotFound() : Ok(result);
    }

    // ── Sections ────────────────────────────────────────────────────────────

    [HttpPost("{id}/sections")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> AddSection(int id, CreateSectionRequest req)
    {
        SectionDto? result = await _service.AddSectionAsync(id, req.Name);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/sections/{sectionId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> UpdateSection(int id, int sectionId, UpdateSectionRequest req)
    {
        SectionDto? result = await _service.UpdateSectionAsync(id, sectionId, req.Name);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}/sections/{sectionId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> DeleteSection(int id, int sectionId)
        => await _service.DeleteSectionAsync(id, sectionId) ? NoContent() : NotFound();

    // Best-effort "what would this delete orphan?" preview for the two-step delete UI (#270).
    // Counts non-cancelled future bookings that would lose their section reference. Falls back to
    // 404 when the section doesn't exist / doesn't belong to the restaurant, so the UI can degrade
    // to generic copy rather than blocking the delete.
    [HttpGet("{id}/sections/{sectionId}/impact")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> GetSectionDeleteImpact(int id, int sectionId)
    {
        DeleteImpactDto? result = await _service.GetSectionDeleteImpactAsync(id, sectionId);
        return result == null ? NotFound() : Ok(result);
    }

    // ── Tables ──────────────────────────────────────────────────────────────

    [HttpPost("{id}/sections/{sectionId}/tables")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> AddTable(int id, int sectionId, CreateTableRequest req)
    {
        TableDto? result = await _service.AddTableAsync(id, sectionId, req.Name, req.Seats);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> UpdateTable(int id, int sectionId, int tableId, UpdateTableRequest req)
    {
        TableDto? result = await _service.UpdateTableAsync(id, sectionId, tableId, req.Name, req.Seats);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> DeleteTable(int id, int sectionId, int tableId)
        => await _service.DeleteTableAsync(id, sectionId, tableId) ? NoContent() : NotFound();

    // Best-effort "what would this delete orphan?" preview for the two-step delete UI (#270).
    // Counts non-cancelled future bookings that would lose their table reference. 404 when the table
    // doesn't exist / doesn't belong to the restaurant+section, so the UI can fall back to generic copy.
    [HttpGet("{id}/sections/{sectionId}/tables/{tableId}/impact")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> GetTableDeleteImpact(int id, int sectionId, int tableId)
    {
        DeleteImpactDto? result = await _service.GetTableDeleteImpactAsync(id, sectionId, tableId);
        return result == null ? NotFound() : Ok(result);
    }

    // Bookings taken under an older schedule (#359). Editing hours/open days/walk-in policy is
    // silent by design — it leaves existing rows alone — so the admin UI reads this after an edit
    // to show who is now booked into a service the location no longer runs. 404 when the
    // restaurant doesn't exist, so the caller can drop the panel rather than block the form.
    [HttpGet("{id}/schedule-conflicts")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> GetScheduleConflicts(int id)
    {
        List<ScheduleConflictDto>? result = await _service.GetScheduleConflictsAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    // ── Combinable table groups (#271) ──────────────────────────────────────
    //
    // Schema + CRUD only here. Wiring groups into availability/auto-assign/holds is the next issue
    // (#272); the admin/diner UIs land after that. ValidationException (member rules, CombinedSeats
    // floor) is mapped to 400 by GlobalExceptionHandler; null result → 404.

    [HttpPost("{id}/groups")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> AddTableGroup(int id, CreateTableGroupRequest req)
    {
        TableGroupDto? result = await _service.AddTableGroupAsync(id, req);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPut("{id}/groups/{groupId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> UpdateTableGroup(int id, int groupId, UpdateTableGroupRequest req)
    {
        TableGroupDto? result = await _service.UpdateTableGroupAsync(id, groupId, req);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id}/groups/{groupId}")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> DeleteTableGroup(int id, int groupId)
        => await _service.DeleteTableGroupAsync(id, groupId) ? NoContent() : NotFound();
}
