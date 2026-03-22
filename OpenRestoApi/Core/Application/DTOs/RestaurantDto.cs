namespace OpenRestoApi.Core.Application.DTOs;

// ── Request types ──────────────────────────────────────────────────────────

public class UpdateRestaurantRequest
{
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
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

public class RestaurantDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public List<SectionDto> Sections { get; set; } = new();
}
