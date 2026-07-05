namespace OpenRestoApi.Core.Domain;

public class Section
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }

    // Relation to Restaurant
    public int RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }

    public ICollection<Table> Tables { get; set; } = new List<Table>();
}
