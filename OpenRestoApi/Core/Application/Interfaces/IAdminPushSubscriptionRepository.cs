using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of <see cref="AdminPushSubscription"/> (browser Web Push endpoints).
/// Per-endpoint dedup is enforced by a unique index in <c>AppDbContext</c>.
/// </summary>
public interface IAdminPushSubscriptionRepository
{
    /// <summary>Finds the subscription for this endpoint, if any.</summary>
    Task<AdminPushSubscription?> GetByEndpointAsync(string endpoint);

    /// <summary>Every subscription (used by the push fan-out — subscriptions are not per-restaurant).</summary>
    Task<List<AdminPushSubscription>> GetAllAsync();

    /// <summary>Adds and saves a subscription.</summary>
    Task<AdminPushSubscription> AddAsync(AdminPushSubscription subscription);

    /// <summary>Removes the given subscriptions (caller is responsible for SaveChanges — used by SendPushAsync stale cleanup).</summary>
    void RemoveRange(IEnumerable<AdminPushSubscription> subscriptions);

    /// <summary>Flushes pending changes on the underlying DbContext.</summary>
    Task SaveChangesAsync();
}
