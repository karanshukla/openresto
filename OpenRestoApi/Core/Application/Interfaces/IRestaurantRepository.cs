using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface IRestaurantRepository
{
    /// <summary>Eager-loads <see cref="Restaurant.Sections"/> with their <see cref="Section.Tables"/>. Excludes archived rows.</summary>
    Task<Restaurant?> GetByIdAsync(int id);

    // ── Bundle 2 additions ───────────────────────────────────────────────────

    /// <summary>Bare lookup by id with NO includes, NO archived filter — for pause/unpause/archive/delete where the soft-delete filter shouldn't apply.</summary>
    Task<Restaurant?> FindByIdAsync(int id);

    /// <summary>All non-archived restaurants, no navigation properties loaded.</summary>
    Task<List<Restaurant>> GetAllActiveAsync();

    /// <summary>All non-archived restaurants with <see cref="Restaurant.Sections"/> and their <see cref="Section.Tables"/> eager-loaded.</summary>
    Task<List<Restaurant>> GetAllActiveWithSectionsAsync();

    /// <summary>Persists a new restaurant and returns the saved entity with its assigned Id.</summary>
    Task<Restaurant> AddAsync(Restaurant restaurant);

    /// <summary>Removes a restaurant (caller should cascade-delete bookings first — see AdminService.DeleteRestaurantAsync).</summary>
    void Remove(Restaurant restaurant);

    /// <summary>Saves all pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();

    /// <summary>True if any restaurant (archived or not) exists with this id.</summary>
    Task<bool> ExistsAsync(int id);

    /// <summary>
    /// Active (in-progress, non-cancelled) bookings count per non-archived restaurant, ordered by name.
    /// Each <see cref="LookupDto"/> carries the restaurant's Id/Name/BookingsPausedUntil/IsArchived plus the
    /// <see cref="LookupDto.ActiveBookingsCount"/> snapshot computed at <paramref name="nowUtc"/>.
    /// Centralizes the correlated-subquery projection previously inlined in AdminService.GetRestaurantsAsync.
    /// </summary>
    Task<List<LookupDto>> GetAllWithActiveBookingsCountAsync(DateTime nowUtc);
}
