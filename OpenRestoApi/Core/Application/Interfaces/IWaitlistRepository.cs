using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface IWaitlistRepository
{
    Task<WaitlistEntry?> GetByIdAsync(int id);
    Task<WaitlistEntry?> GetByRefAsync(string entryRef);

    /// <summary>A location's waiting and notified entries, oldest first.</summary>
    Task<List<WaitlistEntry>> GetActiveForRestaurantAsync(int restaurantId);

    /// <summary>How many entries the location has taken since <paramref name="sinceUtc"/>, whatever became of them.</summary>
    Task<int> CountCreatedSinceAsync(int restaurantId, DateTime sinceUtc);

    Task<WaitlistEntry> AddAsync(WaitlistEntry entry);
    Task SaveChangesAsync();

    /// <summary>Marks every entry still in a queue since before <paramref name="cutoffUtc"/> as expired. Returns the count.</summary>
    Task<int> ExpireActiveCreatedBeforeAsync(DateTime cutoffUtc, DateTime nowUtc);

    /// <summary>Deletes every entry created before <paramref name="cutoffUtc"/>. Returns the count.</summary>
    Task<int> DeleteCreatedBeforeAsync(DateTime cutoffUtc);
}
