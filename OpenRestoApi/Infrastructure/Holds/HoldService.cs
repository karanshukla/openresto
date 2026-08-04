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
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AvailabilityServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.TableAutoAssignerTests")]
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

    /// <inheritdoc/>
    public HoldResult? PlaceGroupHold(
        int restaurantId,
        int tableGroupId,
        IReadOnlyList<int> memberTableIds,
        int sectionId,
        DateTime bookingDate,
        string? currentHoldId = null,
        int durationMinutes = 60)
    {
        // The all-members-free check + the place must share the placement lock so two concurrent
        // group/individual submissions can't both observe a member as free and grab it (TOCTOU).
        lock (_placeLock)
        {
            Cleanup();

            // A group hold requires every member table free (no overlapping hold other than the
            // caller's own current hold). Any member already held → reject.
            foreach (int memberId in memberTableIds)
            {
                if (IsTableHeld(memberId, bookingDate, excludeHoldId: currentHoldId, durationMinutes: durationMinutes))
                {
                    return null;
                }
            }

            // Atomically release the caller's previous hold before placing the new one.
            if (currentHoldId != null)
            {
                _holds.TryRemove(currentHoldId, out _);
            }

            string holdId = Guid.NewGuid().ToString("N");
            DateTime expiresAt = _clock.UtcNow.Add(HoldDuration);
            var entry = new HoldEntry(
                holdId,
                // Anchor table id (first member) so callers that only read TableId still see one.
                memberTableIds.Count > 0 ? memberTableIds[0] : 0,
                sectionId,
                restaurantId,
                bookingDate,
                expiresAt,
                TableGroupId: tableGroupId,
                MemberTableIds: memberTableIds);

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
                // Group candidate → every member must be free; place one multi-member hold.
                if (candidate.IsGroup)
                {
                    bool allFree = true;
                    foreach (int memberId in candidate.Members)
                    {
                        if (IsTableHeld(memberId, bookingDate, excludeHoldId: currentHoldId, durationMinutes: durationMinutes))
                        {
                            allFree = false;
                            break;
                        }
                    }

                    if (!allFree)
                    {
                        continue;
                    }

                    // Atomically release the caller's previous hold before placing the new one.
                    if (currentHoldId != null)
                    {
                        _holds.TryRemove(currentHoldId, out _);
                    }

                    string groupHoldId = Guid.NewGuid().ToString("N");
                    DateTime groupExpiresAt = _clock.UtcNow.Add(HoldDuration);
                    var groupEntry = new HoldEntry(
                        groupHoldId,
                        candidate.TableId,
                        candidate.SectionId,
                        restaurantId,
                        bookingDate,
                        groupExpiresAt,
                        TableGroupId: candidate.TableGroupId,
                        MemberTableIds: candidate.Members);

                    _holds[groupHoldId] = groupEntry;

                    return new AutoAssignResult(
                        groupHoldId,
                        groupExpiresAt,
                        candidate.TableId,
                        candidate.SectionId,
                        IsGroup: true,
                        TableGroupId: candidate.TableGroupId,
                        MemberTableIds: candidate.Members);
                }

                // Single-table candidate → existing path.
                if (IsTableHeld(candidate.TableId, bookingDate, excludeHoldId: currentHoldId, durationMinutes: durationMinutes))
                {
                    continue;
                }

                // Atomically release the caller's previous hold before placing the new one
                if (currentHoldId != null)
                {
                    _holds.TryRemove(currentHoldId, out _);
                }

                string singleHoldId = Guid.NewGuid().ToString("N");
                DateTime singleExpiresAt = _clock.UtcNow.Add(HoldDuration);
                var entry = new HoldEntry(singleHoldId, candidate.TableId, candidate.SectionId, restaurantId, bookingDate, singleExpiresAt);

                _holds[singleHoldId] = entry;

                return new AutoAssignResult(singleHoldId, singleExpiresAt, candidate.TableId, candidate.SectionId);
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
            // A table is busy when this hold is on it directly OR on a group that includes it (#272).
            bool touchesTable = entry.TableId == tableId || entry.Members.Contains(tableId);
            if (!touchesTable)
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
