namespace OpenRestoApi.Core.Domain;

public class Restaurant
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }

    // A restaurant can have multiple sections (e.g., indoor, patio)
    public ICollection<Section> Sections { get; set; } = new List<Section>();
}
