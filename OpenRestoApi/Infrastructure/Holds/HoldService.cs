using System.Collections.Concurrent;
using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Holds;

/// <summary>
/// In-memory hold service. Registered as a Singleton so the dictionary
/// persists across requests. Appropriate for a single-instance deployment
/// (each restaurant runs their own copy). Swap IMemoryCache backing to
/// Redis if multi-instance scaling is ever needed.
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Holds.HoldServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[ExternalAccessAllowed]
internal class HoldService(ISystemClock clock) : IHoldService
{
    private const int _holdDurationMinutes = 5;
    public static readonly TimeSpan HoldDuration = TimeSpan.FromMinutes(_holdDurationMinutes);

    private readonly ISystemClock _clock = clock;
    private readonly ConcurrentDictionary<string, HoldEntry> _holds = new();

    private readonly object _placeLock = new();

    public HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate, string? currentHoldId = null, int durationMinutes = 60)
    {
        lock (_placeLock)
        {
            Cleanup();

            // Pessimistic: assume held; only proceed if the sole blocker is the caller's own current hold
            if (IsTableHeld(tableId, bookingDate, excludeHoldId: currentHoldId, durationMinutes: durationMinutes))
            {
                return null;
            }

            // Atomically release the caller's previous hold before placing the new one
            if (currentHoldId != null)
            {
                _holds.TryRemove(currentHoldId, out _);
            }

            string holdId = Guid.NewGuid().ToString("N");
            DateTime expiresAt = _clock.UtcNow.Add(HoldDuration);
            var entry = new HoldEntry(holdId, tableId, sectionId, restaurantId, bookingDate, expiresAt);

            _holds[holdId] = entry;

            return new HoldResult(holdId, expiresAt);
        }
    }

    public AutoAssignResult? PlaceAutoHold(
        int restaurantId,
        IReadOnlyList<TableCandidate> candidates,
        DateTime bookingDate,
        string? currentHoldId = null,
        int durationMinutes = 60)
    {
        // The candidate scan + the place must happen under the same lock so two concurrent
        // "any" submissions can't both observe the same table as free and grab it (TOCTOU).
        // IsTableHeld reads _holds, and PlaceHold writes to it — both under _placeLock today,
        // so reusing that lock here keeps the auto-assign pick race-free by construction.
        lock (_placeLock)
        {
            Cleanup();

            foreach (TableCandidate candidate in candidates)
            {
                if (IsTableHeld(candidate.TableId, bookingDate, excludeHoldId: currentHoldId, durationMinutes: durationMinutes))
                {
                    continue;
                }

                // Atomically release the caller's previous hold before placing the new one
                if (currentHoldId != null)
                {
                    _holds.TryRemove(currentHoldId, out _);
                }

                string holdId = Guid.NewGuid().ToString("N");
                DateTime expiresAt = _clock.UtcNow.Add(HoldDuration);
                var entry = new HoldEntry(holdId, candidate.TableId, candidate.SectionId, restaurantId, bookingDate, expiresAt);

                _holds[holdId] = entry;

                return new AutoAssignResult(holdId, expiresAt, candidate.TableId, candidate.SectionId);
            }

            return null;
        }
    }

    public void ReleaseHold(string holdId)
    {
        _holds.TryRemove(holdId, out _);
    }

    public bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null, int durationMinutes = 60)
    {
        DateTime start = bookingDate.ToUniversalTime();
        DateTime end = start.AddMinutes(durationMinutes);

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
            DateTime entryEnd = entryStart.AddMinutes(durationMinutes);

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
