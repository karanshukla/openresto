namespace OpenRestoApi.Core.Application.DTOs;

// ── Request types ──────────────────────────────────────────────────────────

public class UpdateRestaurantRequest
{
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string? OpenTime { get; set; }
    public string? CloseTime { get; set; }
    public string? OpenDays { get; set; }

    /// <summary>
    /// Per-day opening hours (ISO day 1=Monday … 7=Sunday). When provided, takes
    /// precedence over OpenTime/CloseTime; identical hours for all 7 days collapse
    /// back into the uniform OpenTime/CloseTime pair.
    /// </summary>
    public List<DayHoursDto>? OpenHours { get; set; }

    public string? Timezone { get; set; }
    public string? Tags { get; set; }
    public int? DefaultBookingDurationMinutes { get; set; }
}

public class PauseRestaurantRequest
{
    public int Minutes { get; set; }
}

public class ExtendRestaurantRequest
{
    public int Minutes { get; set; }
}

public class CreateSectionRequest
{
    public string Name { get; set; } = null!;
}

public class UpdateSectionRequest
{
    public string Name { get; set; } = null!;
}

public class CreateTableRequest
{
    public string? Name { get; set; }
    public int Seats { get; set; }
}

public class UpdateTableRequest
{
    public string? Name { get; set; }
    public int Seats { get; set; }
}

// ── Response DTOs ──────────────────────────────────────────────────────────

public class TableDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public int Seats { get; set; }
}

public class SectionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public List<TableDto> Tables { get; set; } = new();
}

public class DayHoursDto
{
    /// <summary>ISO 8601 day number: 1=Monday … 7=Sunday.</summary>
    public int Day { get; set; }
    public string Open { get; set; } = "09:00";
    public string Close { get; set; } = "22:00";
}

public class RestaurantDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string OpenTime { get; set; } = "09:00";
    public string CloseTime { get; set; } = "22:00";

    /// <summary>Resolved hours for every day of the week (always 7 entries).</summary>
    public List<DayHoursDto> OpenHours { get; set; } = new();

    public string OpenDays { get; set; } = "1,2,3,4,5,6,7";
    public string Timezone { get; set; } = "UTC";
    public string[] Tags { get; set; } = [];
    public string? ImageUrl { get; set; }
    public bool IsArchived { get; set; }
    public int DefaultBookingDurationMinutes { get; set; } = 60;
    public List<SectionDto> Sections { get; set; } = new();
}
