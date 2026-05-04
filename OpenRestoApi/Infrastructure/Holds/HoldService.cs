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

    private readonly object _placeLock = new();

    public HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate)
    {
        lock (_placeLock)
        {
            Cleanup();

            // Reject if an active hold already exists for this table that overlaps with the requested time
            if (IsTableHeld(tableId, bookingDate))
            {
                return null;
            }

            string holdId = Guid.NewGuid().ToString("N");
            DateTime expiresAt = _clock.UtcNow.Add(HoldDuration);
            var entry = new HoldEntry(holdId, tableId, sectionId, restaurantId, bookingDate, expiresAt);

            _holds[holdId] = entry;

            return new HoldResult(holdId, expiresAt);
        }
    }

    public void ReleaseHold(string holdId)
    {
        _holds.TryRemove(holdId, out _);
    }

    public bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null)
    {
        DateTime start = bookingDate.ToUniversalTime();
        DateTime end = start.AddHours(1);

        foreach (HoldEntry entry in _holds.Values)
        {
            if (entry.HoldId == excludeHoldId)
            {
                continue;
            }
            if (entry.ExpiresAt <= _clock.UtcNow)
            {
                continue;
            }
            if (entry.TableId != tableId)
            {
                continue;
            }

            DateTime entryStart = entry.Date.ToUniversalTime();
            DateTime entryEnd = entryStart.AddHours(1);

            // Overlap check: (StartA < EndB) and (EndA > StartB)
            if (entryStart < end && entryEnd > start)
            {
                return true;
            }
        }

        return false;
    }

    public HoldEntry? GetHold(string holdId)
    {
        if (_holds.TryGetValue(holdId, out HoldEntry? entry) && entry.ExpiresAt > _clock.UtcNow)
        {
            return entry;
        }

        return null;
    }

    public int GetActiveHoldsCount()
    {
        Cleanup();
        return _holds.Count;
    }

    private void Cleanup()
    {
        DateTime now = _clock.UtcNow;
        foreach (KeyValuePair<string, HoldEntry> kvp in _holds.ToArray())
        {
            if (kvp.Value.ExpiresAt <= now)
            {
                _holds.TryRemove(kvp.Key, out _);
            }
        }
    }
}
