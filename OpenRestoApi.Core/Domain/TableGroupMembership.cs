namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Join row linking a <see cref="TableGroup"/> to one of its member <see cref="Table"/>s. Composite
/// PK <c>(TableGroupId, TableId)</c>; <see cref="TableId"/> carries a unique index so a table can
/// belong to at most one group (also enforced in service code, since the test suite runs on EF
/// In-Memory which ignores SQL constraints).
/// </summary>
public class TableGroupMembership
{
    public int TableGroupId { get; set; }
    public TableGroup? Group { get; set; }

    public int TableId { get; set; }
    public Table? Table { get; set; }
}
