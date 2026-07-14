using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class RestaurantManagementService(
    IRestaurantRepository restaurantRepository,
    ISectionRepository sectionRepository,
    ITableRepository tableRepository,
    IBookingRepository bookingRepository)
{
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly IBookingRepository _bookingRepository = bookingRepository;

    private static readonly HashSet<int> _allowedBookingDurationsMinutes =
        [30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

    // ── Restaurants ─────────────────────────────────────────────────────────

    public async Task<List<RestaurantDto>> GetAllAsync()
    {
        List<Restaurant> restaurants = await _restaurantRepository.GetAllActiveWithSectionsAsync();
        return restaurants.Select(ToDto).ToList();
    }

    public async Task<RestaurantDto?> GetByIdAsync(int id)
    {
        Restaurant? r = await _restaurantRepository.GetByIdAsync(id);
        return r == null ? null : ToDto(r);
    }

    public async Task<RestaurantDto> CreateAsync(RestaurantDto dto)
    {
        var entity = new Restaurant
        {
            Name = dto.Name,
            Address = dto.Address,
            DefaultBookingDurationMinutes = dto.DefaultBookingDurationMinutes,
            Sections = dto.Sections.Select((s, index) => new Section
            {
                Name = s.Name,
                SortOrder = index,
                Tables = s.Tables.Select(t => new Table { Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
        };

        await _restaurantRepository.AddAsync(entity);
        return ToDto(entity);
    }

    public async Task<RestaurantDto?> UpdateAsync(int id, UpdateRestaurantRequest req)
    {
        Restaurant? r = await _restaurantRepository.FindByIdAsync(id);
        if (r == null)
        {
            return null;
        }

        r.Name = req.Name;
        r.Address = req.Address;
        if (req.Description != null)
        {
            r.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        }
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

        if (req.OpenHours != null)
        {
            OpeningHoursHelper.ApplyOpenHours(r, req.OpenHours);
        }

        if (req.Timezone != null)
        {
            r.Timezone = req.Timezone;
        }

        if (req.Tags != null)
        {
            r.Tags = req.Tags;
        }

        if (req.DefaultBookingDurationMinutes.HasValue)
        {
            if (!_allowedBookingDurationsMinutes.Contains(req.DefaultBookingDurationMinutes.Value))
            {
                throw new ValidationException(
                    $"DefaultBookingDurationMinutes must be one of: {string.Join(", ", _allowedBookingDurationsMinutes.Order())}.");
            }

            r.DefaultBookingDurationMinutes = req.DefaultBookingDurationMinutes.Value;
        }

        if (req.WalkInOnly.HasValue)
        {
            r.WalkInOnly = req.WalkInOnly.Value;
        }

        if (req.WalkInDays != null)
        {
            r.WalkInDays = WalkInHelper.NormalizeWalkInDays(req.WalkInDays);
        }

        await _restaurantRepository.SaveChangesAsync();

        return new RestaurantDto
        {
            Id = r.Id,
            Name = r.Name,
            Address = r.Address,
            OpenTime = r.OpenTime,
            CloseTime = r.CloseTime,
            OpenHours = OpeningHoursHelper.ResolveWeek(r),
            OpenDays = r.OpenDays,
            Timezone = r.Timezone,
            Tags = string.IsNullOrEmpty(r.Tags)
                ? []
                : r.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            ImageUrl = r.ImageUrl,
            Description = r.Description,
            WalkInOnly = r.WalkInOnly,
            WalkInDays = r.WalkInDays ?? "",
            DefaultBookingDurationMinutes = r.DefaultBookingDurationMinutes,
            Sections = []
        };
    }

    // ── Sections ────────────────────────────────────────────────────────────

    public async Task<SectionDto?> AddSectionAsync(int restaurantId, string name)
    {
        Restaurant? r = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (r == null)
        {
            return null;
        }

        int nextSortOrder = await _sectionRepository.CountByRestaurantAsync(restaurantId);
        var section = new Section { Name = name, RestaurantId = restaurantId, SortOrder = nextSortOrder };
        await _sectionRepository.AddAsync(section);

        return new SectionDto { Id = section.Id, Name = section.Name, SortOrder = section.SortOrder, Tables = [] };
    }

    public async Task<SectionDto?> UpdateSectionAsync(int restaurantId, int sectionId, string name)
    {
        Section? section = await _sectionRepository.FindForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return null;
        }

        section.Name = name;
        await _sectionRepository.SaveChangesAsync();
        return new SectionDto { Id = section.Id, Name = section.Name, SortOrder = section.SortOrder, Tables = [] };
    }

    public async Task<bool> DeleteSectionAsync(int restaurantId, int sectionId)
    {
        Section? section = await _sectionRepository.GetWithTablesForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return false;
        }

        // FK-null affected bookings before removing the section. All entities share the same scoped
        // DbContext, so the booking mutations + the section removal below flush in a single SaveChanges.
        var tableIds = section.Tables.Select(t => t.Id).ToList();
        List<Booking> affected = await _bookingRepository.GetBySectionOrTablesAsync(sectionId, tableIds);
        foreach (Booking b in affected)
        {
            b.TableId = null;
            b.SectionId = null;
        }

        _sectionRepository.Remove(section);
        await _sectionRepository.SaveChangesAsync();
        return true;
    }

    // ── Tables ──────────────────────────────────────────────────────────────

    public async Task<TableDto?> AddTableAsync(int restaurantId, int sectionId, string? name, int seats)
    {
        Section? section = await _sectionRepository.FindForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return null;
        }

        var table = new Table { Name = name, Seats = seats, SectionId = sectionId };
        await _tableRepository.AddAsync(table);

        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    public async Task<TableDto?> UpdateTableAsync(int restaurantId, int sectionId, int tableId, string? name, int seats)
    {
        Table? table = await _tableRepository.GetForRestaurantAsync(tableId, sectionId, restaurantId);

        if (table == null)
        {
            return null;
        }

        table.Name = name;
        table.Seats = seats;
        await _tableRepository.SaveChangesAsync();

        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    public async Task<bool> DeleteTableAsync(int restaurantId, int sectionId, int tableId)
    {
        Table? table = await _tableRepository.GetForRestaurantAsync(tableId, sectionId, restaurantId);

        if (table == null)
        {
            return false;
        }

        // FK-null bookings on this table before removing it (same single-save pattern as DeleteSection).
        List<Booking> affected = await _bookingRepository.GetByTableAsync(tableId);
        foreach (Booking b in affected)
            b.TableId = null;

        _tableRepository.Remove(table);
        await _tableRepository.SaveChangesAsync();
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
        OpenHours = OpeningHoursHelper.ResolveWeek(r),
        OpenDays = r.OpenDays,
        Timezone = r.Timezone,
        Tags = string.IsNullOrEmpty(r.Tags)
            ? []
            : r.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        ImageUrl = r.ImageUrl,
        Description = r.Description,
        IsArchived = r.IsArchived,
        WalkInOnly = r.WalkInOnly,
        WalkInDays = r.WalkInDays ?? "",
        DefaultBookingDurationMinutes = r.DefaultBookingDurationMinutes,
        Sections = r.Sections
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .Select(s => new SectionDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
    };
}
