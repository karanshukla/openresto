using System.Collections.Concurrent;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Holds;

/// <summary>
/// In-memory hold service. Registered as a Singleton so the dictionary
/// persists across requests. Appropriate for a single-instance deployment
/// (each restaurant runs their own copy). Swap IMemoryCache backing to
/// Redis if multi-instance scaling is ever needed.
/// </summary>
public class HoldService(ISystemClock clock) : IHoldService
{
    private const int _holdDurationMinutes = 5;
    public static readonly TimeSpan HoldDuration = TimeSpan.FromMinutes(_holdDurationMinutes);

    private readonly ISystemClock _clock = clock;
    private readonly ConcurrentDictionary<string, HoldEntry> _holds = new();

    // tableKey ("{tableId}:{yyyy-MM-dd}") → holdId, for fast availability checks
    private readonly ConcurrentDictionary<string, string> _tableIndex = new();

    private readonly object _placeLock = new();

    public HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate)
    {
        lock (_placeLock)
        {
            Cleanup();

            string tableKey = TableKey(tableId, bookingDate);

            // Reject if an active hold already exists for this table+date
            if (_tableIndex.TryGetValue(tableKey, out string? existingId) &&
                _holds.TryGetValue(existingId, out HoldEntry? existing) &&
                existing.ExpiresAt > _clock.UtcNow)
            {
                return null;
            }

            string holdId = Guid.NewGuid().ToString("N");
            DateTime expiresAt = _clock.UtcNow.Add(HoldDuration);
            var entry = new HoldEntry(holdId, tableId, sectionId, restaurantId, bookingDate, expiresAt);

            _holds[holdId] = entry;
            _tableIndex[tableKey] = holdId;

            return new HoldResult(holdId, expiresAt);
        }
    }

    public void ReleaseHold(string holdId)
    {
        if (_holds.TryRemove(holdId, out HoldEntry? entry))
        {
            // Only remove the table index if it still points to this specific hold
            // (prevents removing a newer hold if this one had already been replaced)
            string tableKey = TableKey(entry.TableId, entry.Date);
            if (_tableIndex.TryGetValue(tableKey, out string? currentId) && currentId == holdId)
            {
                _tableIndex.TryRemove(tableKey, out _);
            }
        }
    }

    public bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null)
    {
        string tableKey = TableKey(tableId, bookingDate);
        if (!_tableIndex.TryGetValue(tableKey, out string? holdId))
        {
            return false;
        }

        if (holdId == excludeHoldId)
        {
            return false;
        }

        return _holds.TryGetValue(holdId, out HoldEntry? entry) && entry.ExpiresAt > _clock.UtcNow;
    }

    public HoldEntry? GetHold(string holdId)
    {
        if (_holds.TryGetValue(holdId, out HoldEntry? entry) && entry.ExpiresAt > _clock.UtcNow)
        {
            return entry;
        }

        return null;
    }

    private void Cleanup()
    {
        DateTime now = _clock.UtcNow;
        foreach (KeyValuePair<string, HoldEntry> kvp in _holds.ToArray())
        {
            if (kvp.Value.ExpiresAt > now)
            {
                continue;
            }

            if (_holds.TryRemove(kvp.Key, out HoldEntry? entry))
            {
                string tableKey = TableKey(entry.TableId, entry.Date);
                if (_tableIndex.TryGetValue(tableKey, out string? currentId) && currentId == kvp.Key)
                {
                    _tableIndex.TryRemove(tableKey, out _);
                }
            }
        }
    }

    private static string TableKey(int tableId, DateTime date) =>
        $"{tableId}:{date.ToUniversalTime():yyyy-MM-dd}";
}
