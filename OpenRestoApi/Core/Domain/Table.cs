namespace OpenRestoApi.Core.Domain;

public class Table
{
    public int Id { get; set; }
    public string? Name { get; set; }

    public int Seats { get; set; }

    /// <summary>
    /// Held back for the door: never offered or bookable online, but staff can still seat a
    /// party here from the admin or the waitlist. A combinable group with a walk-in-only member
    /// is held back with it, or an online group booking would take the table anyway.
    /// </summary>
    public bool WalkInOnly { get; set; }

    // Relation to Section
    public int SectionId { get; set; }
    public Section? Section { get; set; }
}
