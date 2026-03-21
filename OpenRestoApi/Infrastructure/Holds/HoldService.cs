using System.Collections.Concurrent;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Holds;

/// <summary>
/// In-memory hold service. Registered as a Singleton so the dictionary
/// persists across requests. Appropriate for a single-instance deployment
/// (each restaurant runs their own copy). Swap IMemoryCache backing to
/// Redis if multi-instance scaling is ever needed.
/// </summary>
public class HoldService : IHoldService
{
    public static readonly TimeSpan HoldDuration = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<string, HoldEntry> _holds = new();

    // tableKey ("{tableId}:{yyyy-MM-dd}") → holdId, for fast availability checks
    private readonly ConcurrentDictionary<string, string> _tableIndex = new();

    private readonly object _placeLock = new();

    public HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime date)
    {
        lock (_placeLock)
        {
            Cleanup();

            var tableKey = TableKey(tableId, date);

            // Reject if an active hold already exists for this table+date
            if (_tableIndex.TryGetValue(tableKey, out var existingId) &&
                _holds.TryGetValue(existingId, out var existing) &&
                existing.ExpiresAt > DateTime.UtcNow)
            {
                return null;
            }

            var holdId = Guid.NewGuid().ToString("N");
            var expiresAt = DateTime.UtcNow.Add(HoldDuration);
            var entry = new HoldEntry(holdId, tableId, sectionId, restaurantId, date, expiresAt);

            _holds[holdId] = entry;
            _tableIndex[tableKey] = holdId;

            return new HoldResult(holdId, expiresAt);
        }
    }

    public void ReleaseHold(string holdId)
    {
        if (_holds.TryRemove(holdId, out var entry))
        {
            // Only remove the table index if it still points to this specific hold
            // (prevents removing a newer hold if this one had already been replaced)
            var tableKey = TableKey(entry.TableId, entry.Date);
            if (_tableIndex.TryGetValue(tableKey, out var currentId) && currentId == holdId)
            {
                _tableIndex.TryRemove(tableKey, out _);
            }
        }
    }

    public bool IsTableHeld(int tableId, DateTime date, string? excludeHoldId = null)
    {
        var tableKey = TableKey(tableId, date);
        if (!_tableIndex.TryGetValue(tableKey, out var holdId)) return false;
        if (holdId == excludeHoldId) return false;
        return _holds.TryGetValue(holdId, out var entry) && entry.ExpiresAt > DateTime.UtcNow;
    }

    public HoldEntry? GetHold(string holdId)
    {
        if (_holds.TryGetValue(holdId, out var entry) && entry.ExpiresAt > DateTime.UtcNow)
            return entry;
        return null;
    }

    /// <summary>
    /// Removes all expired holds. Called before PlaceHold to keep memory clean.
    /// A background service could also call this periodically if needed.
    /// </summary>
    private void Cleanup()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _holds.ToArray())
        {
            if (kvp.Value.ExpiresAt > now) continue;

            if (_holds.TryRemove(kvp.Key, out var entry))
            {
                var tableKey = TableKey(entry.TableId, entry.Date);
                if (_tableIndex.TryGetValue(tableKey, out var currentId) && currentId == kvp.Key)
                    _tableIndex.TryRemove(tableKey, out _);
            }
        }
    }

    private static string TableKey(int tableId, DateTime date) =>
        $"{tableId}:{date.ToUniversalTime():yyyy-MM-dd}";
}
