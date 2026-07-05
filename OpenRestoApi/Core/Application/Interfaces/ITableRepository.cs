using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface ITableRepository
{
    Task<Table?> GetByIdAsync(int id);

    // ── Bundle 2 additions ───────────────────────────────────────────────────

    /// <summary>Bare lookup by id with NO includes.</summary>
    Task<Table?> FindByIdAsync(int id);

    /// <summary>
    /// Loads the table with its <see cref="Table.Section"/> (and that section's <see cref="Section.Restaurant"/>)
    /// eager-loaded, restricted to a specific section id — used by AdminService.CreateBookingAsync to
    /// validate the table belongs to the requested section.
    /// </summary>
    Task<Table?> GetWithSectionRestaurantAsync(int tableId, int sectionId);

    /// <summary>
    /// Loads the table with its <see cref="Table.Section"/> only, filtered by id and restaurant id.
    /// Used by AdminService.AdminUpdateBookingAsync to validate a reassignment target.
    /// </summary>
    Task<Table?> GetWithSectionForRestaurantAsync(int tableId, int restaurantId);

    /// <summary>Total tables in a restaurant (across all sections) — used by the capacity notification.</summary>
    Task<int> CountByRestaurantAsync(int restaurantId);

    /// <summary>Adds a table.</summary>
    Task AddAsync(Table table);

    /// <summary>Removes a table.</summary>
    void Remove(Table table);

    /// <summary>
    /// Filtered lookup by (tableId, sectionId, restaurantId) with <see cref="Table.Section"/> eager-loaded —
    /// used by RestaurantManagementService update/delete-table to validate the table's ownership.
    /// </summary>
    Task<Table?> GetForRestaurantAsync(int tableId, int sectionId, int restaurantId);

    /// <summary>Flushes pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();
}
