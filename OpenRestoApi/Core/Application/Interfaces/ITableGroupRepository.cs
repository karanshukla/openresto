using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface ITableGroupRepository
{
    /// <summary>
    /// Loads a group with its <see cref="TableGroup.Members"/> (and each member's <see cref="Table"/>)
    /// eager-loaded, restricted to a specific restaurant — used by update/delete to validate ownership
    /// and mutate the member set. Returns null when the group doesn't exist or belongs elsewhere.
    /// </summary>
    Task<TableGroup?> GetByIdWithMembersAsync(int groupId, int restaurantId);

    /// <summary>
    /// All groups for a restaurant, with members (and their tables) eager-loaded, ordered by Id for
    /// deterministic DTO output.
    /// </summary>
    Task<List<TableGroup>> GetAllWithMembersByRestaurantAsync(int restaurantId);

    /// <summary>Adds a group (caller is responsible for SaveChanges).</summary>
    Task AddAsync(TableGroup group);

    /// <summary>Removes a group (caller is responsible for SaveChanges; memberships cascade).</summary>
    void Remove(TableGroup group);

    /// <summary>Flushes pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();
}
