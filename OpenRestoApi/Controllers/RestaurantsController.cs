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
}
