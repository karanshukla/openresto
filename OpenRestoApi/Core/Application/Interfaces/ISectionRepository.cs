using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface ISectionRepository
{
    Task<Section?> GetByIdAsync(int id);

    // ── Bundle 2 additions ───────────────────────────────────────────────────

    /// <summary>Bare lookup by id with NO includes.</summary>
    Task<Section?> FindByIdAsync(int id);

    /// <summary>All sections for a restaurant, ordered by <see cref="Section.SortOrder"/> then Id.</summary>
    Task<List<Section>> GetByRestaurantAsync(int restaurantId);

    /// <summary>
    /// All sections for a restaurant, ordered by <see cref="Section.SortOrder"/> then Id, with
    /// <see cref="Section.Tables"/> eager-loaded when <paramref name="includeTables"/> is true.
    /// Used by the admin tables grid.
    /// </summary>
    Task<List<Section>> GetByRestaurantAsync(int restaurantId, bool includeTables);

    /// <summary>Current count of sections in a restaurant — used to compute the next SortOrder on insert.</summary>
    Task<int> CountByRestaurantAsync(int restaurantId);

    /// <summary>
    /// Applies a new display order to a restaurant's sections.
    /// Returns null if the restaurant doesn't exist, false if <paramref name="sectionIds"/> doesn't
    /// exactly match the restaurant's current sections (count, distinctness, ids), true on success.
    /// </summary>
    Task<bool?> ReorderAsync(int restaurantId, IReadOnlyList<int> sectionIds);

    /// <summary>Adds a section.</summary>
    Task AddAsync(Section section);

    /// <summary>Removes a section.</summary>
    void Remove(Section section);

    /// <summary>Bare filtered lookup by (sectionId, restaurantId) with NO includes — used by update-section.</summary>
    Task<Section?> FindForRestaurantAsync(int sectionId, int restaurantId);

    /// <summary>Filtered lookup by (sectionId, restaurantId) with <see cref="Section.Tables"/> eager-loaded — used by delete-section to FK-null affected bookings.</summary>
    Task<Section?> GetWithTablesForRestaurantAsync(int sectionId, int restaurantId);

    /// <summary>Flushes pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();
}
