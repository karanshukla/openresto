namespace OpenRestoApi.Core.Application.DTOs;

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
