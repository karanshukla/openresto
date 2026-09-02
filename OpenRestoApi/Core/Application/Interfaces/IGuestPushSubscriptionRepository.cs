using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Persistence of <see cref="GuestPushSubscription"/>. Per (bookingId, endpoint) dedup is
/// enforced by a unique index in <c>AppDbContext</c>.
/// </summary>
public interface IGuestPushSubscriptionRepository
{
    Task<GuestPushSubscription?> GetByBookingAndEndpointAsync(int bookingId, string endpoint);

    /// <summary>
    /// Subscriptions whose booking is still ahead of <paramref name="nowUtc"/> and not cancelled,
    /// with the booking and its restaurant loaded. The reminder pass decides which are due.
    /// </summary>
    Task<List<GuestPushSubscription>> GetUpcomingAsync(DateTime nowUtc);

    /// <summary>Removes subscriptions whose booking has started or been cancelled. Returns the count removed.</summary>
    Task<int> PruneSpentAsync(DateTime nowUtc);

    Task<GuestPushSubscription> AddAsync(GuestPushSubscription subscription);
    void RemoveRange(IEnumerable<GuestPushSubscription> subscriptions);
    Task SaveChangesAsync();
}
