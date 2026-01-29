namespace OpenRestoApi.Core.Domain;

public class Table
{
    public int Id { get; set; }
    public string? Name { get; set; }

    // Number of seats for this table
    public int Seats { get; set; }

    // Relation to Section
    public int SectionId { get; set; }
    public Section? Section { get; set; }
}
