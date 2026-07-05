using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of <see cref="AdminPushSubscription"/> (browser Web Push endpoints).
/// Per (endpoint, restaurantId) dedup is enforced by a unique index in <c>AppDbContext</c>.
/// </summary>
public interface IAdminPushSubscriptionRepository
{
    /// <summary>Finds the subscription for this endpoint at this restaurant, if any.</summary>
    Task<AdminPushSubscription?> GetByEndpointAndRestaurantAsync(string endpoint, int restaurantId);

    /// <summary>All subscriptions for a restaurant (used by the push fan-out).</summary>
    Task<List<AdminPushSubscription>> GetByRestaurantAsync(int restaurantId);

    /// <summary>All subscriptions across all restaurants matching an endpoint (used by global unsubscribe).</summary>
    Task<List<AdminPushSubscription>> GetByEndpointAsync(string endpoint);

    /// <summary>Adds and saves a subscription.</summary>
    Task<AdminPushSubscription> AddAsync(AdminPushSubscription subscription);

    /// <summary>Removes the given subscriptions (caller is responsible for SaveChanges — used by SendPushAsync stale cleanup).</summary>
    void RemoveRange(IEnumerable<AdminPushSubscription> subscriptions);

    /// <summary>Flushes pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();
}
