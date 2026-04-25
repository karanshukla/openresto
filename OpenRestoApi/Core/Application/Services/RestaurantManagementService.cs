using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class RestaurantManagementService(AppDbContext db)
{
    private readonly AppDbContext _db = db;

    // ── Restaurants ─────────────────────────────────────────────────────────

    public async Task<List<RestaurantDto>> GetAllAsync()
    {
        var restaurants = await _db.Restaurants
            .Include(r => r.Sections)
                .ThenInclude(s => s.Tables)
            .ToListAsync();

        return restaurants.Select(ToDto).ToList();
    }

    public async Task<RestaurantDto?> GetByIdAsync(int id)
    {
        Restaurant? r = await _db.Restaurants
            .Include(x => x.Sections)
                .ThenInclude(s => s.Tables)
            .FirstOrDefaultAsync(x => x.Id == id);

        return r == null ? null : ToDto(r);
    }

    public async Task<RestaurantDto> CreateAsync(RestaurantDto dto)
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
        return ToDto(entity);
    }

    public async Task<RestaurantDto?> UpdateAsync(int id, UpdateRestaurantRequest req)
    {
        Restaurant? r = await _db.Restaurants.FindAsync(id);
        if (r == null)
        {
            return null;
        }

        r.Name = req.Name;
        r.Address = req.Address;
        if (req.OpenTime != null)
        {
            r.OpenTime = req.OpenTime;
        }

        if (req.CloseTime != null)
        {
            r.CloseTime = req.CloseTime;
        }

        if (req.OpenDays != null)
        {
            r.OpenDays = req.OpenDays;
        }

        if (req.Timezone != null)
        {
            r.Timezone = req.Timezone;
        }

        await _db.SaveChangesAsync();

        return new RestaurantDto
        {
            Id = r.Id,
            Name = r.Name,
            Address = r.Address,
            OpenTime = r.OpenTime,
            CloseTime = r.CloseTime,
            OpenDays = r.OpenDays,
            Timezone = r.Timezone,
            Sections = []
        };
    }

    // ── Sections ────────────────────────────────────────────────────────────

    public async Task<SectionDto?> AddSectionAsync(int restaurantId, string name)
    {
        Restaurant? r = await _db.Restaurants.FindAsync(restaurantId);
        if (r == null)
        {
            return null;
        }

        var section = new Section { Name = name, RestaurantId = restaurantId };
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();

        return new SectionDto { Id = section.Id, Name = section.Name, Tables = [] };
    }

    public async Task<SectionDto?> UpdateSectionAsync(int restaurantId, int sectionId, string name)
    {
        Section? section = await _db.Sections
            .FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == restaurantId);

        if (section == null)
        {
            return null;
        }

        section.Name = name;
        await _db.SaveChangesAsync();
        return new SectionDto { Id = section.Id, Name = section.Name, Tables = [] };
    }

    public async Task<bool> DeleteSectionAsync(int restaurantId, int sectionId)
    {
        Section? section = await _db.Sections
            .FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == restaurantId);

        if (section == null)
        {
            return false;
        }

        _db.Sections.Remove(section);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Tables ──────────────────────────────────────────────────────────────

    public async Task<TableDto?> AddTableAsync(int restaurantId, int sectionId, string? name, int seats)
    {
        Section? section = await _db.Sections
            .FirstOrDefaultAsync(s => s.Id == sectionId && s.RestaurantId == restaurantId);

        if (section == null)
        {
            return null;
        }

        var table = new Table { Name = name, Seats = seats, SectionId = sectionId };
        _db.Tables.Add(table);
        await _db.SaveChangesAsync();

        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    public async Task<TableDto?> UpdateTableAsync(int sectionId, int tableId, string? name, int seats)
    {
        Table? table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId);

        if (table == null)
        {
            return null;
        }

        table.Name = name;
        table.Seats = seats;
        await _db.SaveChangesAsync();

        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    public async Task<bool> DeleteTableAsync(int sectionId, int tableId)
    {
        Table? table = await _db.Tables
            .FirstOrDefaultAsync(t => t.Id == tableId && t.SectionId == sectionId);

        if (table == null)
        {
            return false;
        }

        _db.Tables.Remove(table);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static RestaurantDto ToDto(Restaurant r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Address = r.Address,
        OpenTime = r.OpenTime,
        CloseTime = r.CloseTime,
        OpenDays = r.OpenDays,
        Timezone = r.Timezone,
        Sections = r.Sections.Select(s => new SectionDto
        {
            Id = s.Id,
            Name = s.Name,
            Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
        }).ToList()
    };
}
