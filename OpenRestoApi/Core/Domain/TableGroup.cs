namespace OpenRestoApi.Core.Domain;

/// <summary>
/// A set of physical <see cref="Table"/>s an admin has flagged as combinable — e.g. tables 8 &amp; 9,
/// which seat 4 each on their own but together can be booked for a party of 5–8 with the tables
/// pushed together. Modeled as a first-class bookable unit so a <see cref="Booking"/> stays 1:1 with
/// whatever it reserves (group OR single table), keeping the blast radius of combinable tables inside
/// the candidate-building step rather than rippling through holds/availability/cancellation.
/// </summary>
public class TableGroup
{
    public int Id { get; set; }

    /// <summary>
    /// Optional admin-assigned label (e.g. "Window booths"). Null for an unnamed group — the UI
    /// renders a fallback label from the member table names.
    /// </summary>
    public string? Name { get; set; }

    public int RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }

    /// <summary>
    /// Stored, not computed, seating capacity of the combined tables. Set by the admin on create
    /// because restaurants commonly lose a seat when pushing tables together (a shared corner
    /// disappears); validated server-side as &gt;= the sum of member seats to catch obvious mistakes
    /// but allowed to go higher.
    /// </summary>
    public int CombinedSeats { get; set; }

    /// <summary>Member tables (the physical tables pushed together). A table belongs to at most one group.</summary>
    public ICollection<TableGroupMembership> Members { get; set; } = new List<TableGroupMembership>();
}
