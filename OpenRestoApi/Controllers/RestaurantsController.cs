using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RestaurantsController : ControllerBase
{
    private readonly AppDbContext _db;

    public RestaurantsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IEnumerable<RestaurantDto>> Get()
    {
        return await _db.Restaurants
            .Include(r => r.Sections)
                .ThenInclude(s => s.Tables)
            .Select(r => new RestaurantDto
            {
                Id = r.Id,
                Name = r.Name,
                Address = r.Address,
                Sections = r.Sections.Select(s => new SectionDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
                }).ToList()
            })
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var r = await _db.Restaurants
            .Include(x => x.Sections)
                .ThenInclude(s => s.Tables)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r == null) return NotFound();

        var dto = new RestaurantDto
        {
            Id = r.Id,
            Name = r.Name,
            Address = r.Address,
            Sections = r.Sections.Select(s => new SectionDto
            {
                Id = s.Id,
                Name = s.Name,
                Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
        };

        return Ok(dto);
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Post(RestaurantDto dto)
    {
        var entity = new Restaurant
        {
            Name = dto.Name,
            Address = dto.Address,
            Sections = dto.Sections.Select(s => new Section
            {
                Name = s.Name,
                Tables = s.Tables.Select(t => new Table { Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
        };

        _db.Restaurants.Add(entity);
        await _db.SaveChangesAsync();

        var created = new RestaurantDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Address = entity.Address,
            Sections = entity.Sections.Select(s => new SectionDto
            {
                Id = s.Id,
                Name = s.Name,
                Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
        };

        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    // ── Restaurant update ──────────────────────────────────────────────────

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Put(int id, UpdateRestaurantRequest req)
    {
        var r = await _db.Restaurants.FindAsync(id);
        if (r == null) return NotFound();

        r.Name = req.Name;
        r.Address = req.Address;
        await _db.SaveChangesAsync();

        return Ok(new RestaurantDto
        {
            Id = r.Id,
            Name = r.Name,
            Address = r.Address,
            Sections = []
        });
    }

    // ── Section endpoints ──────────────────────────────────────────────────

    [HttpPost("{id}/sections")]
    [Authorize]
    public async Task<IActionResult> AddSection(int id, CreateSectionRequest req)
    {
        var r = await _db.Restaurants.FindAsync(id);
        if (r == null) return NotFound();

        var section = new Section { Name = req.Name, RestaurantId = id };
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();

        return Ok(new SectionDto { Id = section.Id, Name = section.Name, Tables = [] });
    }

    [HttpPut("{id}/sections/{sectionId}")]
    [Authorize]
    public async Task<IActionResult> UpdateSection(int id, int sectionId, UpdateSectionRequest req)
    {
        var section = await _db.Sections.FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == id);
        if (section == null) return NotFound();

        section.Name = req.Name;
        await _db.SaveChangesAsync();

        return Ok(new SectionDto { Id = section.Id, Name = section.Name, Tables = [] });
    }

    [HttpDelete("{id}/sections/{sectionId}")]
    [Authorize]
    public async Task<IActionResult> DeleteSection(int id, int sectionId)
    {
        var section = await _db.Sections.FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == id);
        if (section == null) return NotFound();

        _db.Sections.Remove(section);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ── Table endpoints ────────────────────────────────────────────────────

    [HttpPost("{id}/sections/{sectionId}/tables")]
    [Authorize]
    public async Task<IActionResult> AddTable(int id, int sectionId, CreateTableRequest req)
    {
        var section = await _db.Sections.FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == id);
        if (section == null) return NotFound();

        var table = new Table { Name = req.Name, Seats = req.Seats, SectionId = sectionId };
        _db.Tables.Add(table);
        await _db.SaveChangesAsync();

        return Ok(new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats });
    }

    [HttpPut("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize]
    public async Task<IActionResult> UpdateTable(int id, int sectionId, int tableId, UpdateTableRequest req)
    {
        var table = await _db.Tables.FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId);
        if (table == null) return NotFound();

        table.Name = req.Name;
        table.Seats = req.Seats;
        await _db.SaveChangesAsync();

        return Ok(new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats });
    }

    [HttpDelete("{id}/sections/{sectionId}/tables/{tableId}")]
    [Authorize]
    public async Task<IActionResult> DeleteTable(int id, int sectionId, int tableId)
    {
        var table = await _db.Tables.FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId);
        if (table == null) return NotFound();

        _db.Tables.Remove(table);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}
