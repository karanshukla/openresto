using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Infrastructure.Holds;

namespace OpenRestoApi.Tests.Holds;

public class HoldServiceTests
{
    private readonly FakeClock _clock;
    private readonly HoldService _svc;

    private static readonly DateTime _baseTime = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
    private const int _restaurantId = 1;
    private const int _sectionId = 1;
    private const int _tableId = 42;
    private static readonly DateTime _bookingDate = new(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc);

    public HoldServiceTests()
    {
        _clock = new FakeClock(_baseTime);
        _svc = new HoldService(_clock);
    }

    // ── PlaceHold ────────────────────────────────────────────────────────────

    [Fact]
    public void PlaceHold_ReturnsResult_ForFreshTableAndDate()
    {
        HoldResult? result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.NotNull(result);
        Assert.NotEmpty(result.HoldId);
        Assert.Equal(_baseTime.Add(HoldService.HoldDuration), result.ExpiresAt);
    }

    [Fact]
    public void PlaceHold_ReturnsNull_WhenTableAlreadyHeld()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        HoldResult? second = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.Null(second);
    }

    [Fact]
    public void PlaceHold_Succeeds_AfterPreviousHoldReleased()
    {
        HoldResult first = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _svc.ReleaseHold(first.HoldId);

        HoldResult? second = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.NotNull(second);
        Assert.NotEqual(first.HoldId, second!.HoldId);
    }

    [Fact]
    public void PlaceHold_Succeeds_AfterPreviousHoldExpires()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);
        _clock.Advance(HoldService.HoldDuration + TimeSpan.FromSeconds(1));

        HoldResult? second = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.NotNull(second);
    }

    [Fact]
    public void PlaceHold_DifferentDates_DoNotConflict()
    {
        DateTime date2 = _bookingDate.AddDays(1);
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        HoldResult? result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, date2);

        Assert.NotNull(result);
    }

    [Fact]
    public void PlaceHold_DifferentTables_DoNotConflict()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        HoldResult? result = _svc.PlaceHold(_restaurantId, _tableId + 1, _sectionId, _bookingDate);

        Assert.NotNull(result);
    }

    [Fact]
    public void PlaceHold_WithCurrentHoldId_AtomicallyReplaces()
    {
        HoldResult first = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;

        // Same table, overlapping time — passes currentHoldId so backend skips it
        HoldResult? second = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate, currentHoldId: first.HoldId);

        Assert.NotNull(second);
        Assert.NotEqual(first.HoldId, second!.HoldId);
        // Old hold must be gone
        Assert.Null(_svc.GetHold(first.HoldId));
    }

    [Fact]
    public void PlaceHold_WithCurrentHoldId_StillRejectsIfHeldByOther()
    {
        // Someone else holds the table
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        // A different caller tries to replace with an unrelated currentHoldId
        HoldResult? attempt = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate, currentHoldId: "unrelated-id");

        Assert.Null(attempt);
    }

    [Fact]
    public void PlaceHold_WithCurrentHoldId_DoesNotLeakOldHoldOnConflict()
    {
        HoldResult first = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        // Second user grabs same slot
        _svc.PlaceHold(_restaurantId + 1, _tableId + 1, _sectionId, _bookingDate.AddDays(1));

        // First user tries to swap time (same table, nearby time held by someone else)
        DateTime nearby = _bookingDate.AddMinutes(30);
        int otherTable = _tableId + 10;
        _svc.PlaceHold(_restaurantId, otherTable, _sectionId, nearby);

        // First user tries to move to that nearby slot — should be rejected, original hold untouched
        HoldResult? swap = _svc.PlaceHold(_restaurantId, otherTable, _sectionId, nearby, currentHoldId: first.HoldId);

        Assert.Null(swap);
        // first.HoldId must NOT have been removed (atomic: only remove on success)
        Assert.NotNull(_svc.GetHold(first.HoldId));
    }

    // ── ReleaseHold ──────────────────────────────────────────────────────────

    [Fact]
    public void ReleaseHold_AllowsNewHoldOnSameTable()
    {
        HoldResult hold = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _svc.ReleaseHold(hold.HoldId);

        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate));
    }

    [Fact]
    public void ReleaseHold_IsIdempotent()
    {
        HoldResult hold = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _svc.ReleaseHold(hold.HoldId);

        // Should not throw
        _svc.ReleaseHold(hold.HoldId);
    }

    [Fact]
    public void ReleaseHold_NonExistentId_DoesNotThrow()
    {
        _svc.ReleaseHold("nonexistent-id");
    }

    [Fact]
    public void ReleaseHold_DoesNotRemoveNewerHold()
    {
        HoldResult first = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _clock.Advance(HoldService.HoldDuration + TimeSpan.FromSeconds(1));

        // First expired; a new hold can be placed
        _ = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;

        // Releasing the old hold ID should not affect the new hold
        _svc.ReleaseHold(first.HoldId);

        Assert.True(_svc.IsTableHeld(_tableId, _bookingDate));
    }

    // ── IsTableHeld ──────────────────────────────────────────────────────────

    [Fact]
    public void IsTableHeld_ReturnsTrue_ForActiveHold()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.True(_svc.IsTableHeld(_tableId, _bookingDate));
    }

    [Fact]
    public void IsTableHeld_ReturnsFalse_WhenNoHoldPlaced()
    {
        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate));
    }

    [Fact]
    public void IsTableHeld_ReturnsFalse_WhenExcludedByHoldId()
    {
        HoldResult hold = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;

        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate, excludeHoldId: hold.HoldId));
    }

    [Fact]
    public void IsTableHeld_ReturnsFalse_AfterHoldExpires()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);
        _clock.Advance(HoldService.HoldDuration + TimeSpan.FromSeconds(1));

        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate));
    }

    [Fact]
    public void IsTableHeld_ReturnsFalse_ForDifferentDate()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate.AddDays(1)));
    }

    // ── Configurable booking duration (#135) ────────────────────────────────

    [Fact]
    public void IsTableHeld_UsesDefaultSixtyMinuteWindow_WhenDurationNotSpecified()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate);

        // 90 minutes after the held start is outside a default 60-minute window
        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate.AddMinutes(90)));
    }

    [Fact]
    public void IsTableHeld_ReturnsTrue_WhenWithinCustomDurationWindow()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate, durationMinutes: 120);

        // 90 minutes after the held start is still within a 120-minute occupancy window
        Assert.True(_svc.IsTableHeld(_tableId, _bookingDate.AddMinutes(90), durationMinutes: 120));
    }

    [Fact]
    public void IsTableHeld_ReturnsFalse_OutsideCustomDurationWindow()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate, durationMinutes: 120);

        // 150 minutes after the held start is beyond a 120-minute occupancy window
        Assert.False(_svc.IsTableHeld(_tableId, _bookingDate.AddMinutes(150), durationMinutes: 120));
    }

    [Fact]
    public void PlaceHold_ReturnsNull_WhenNewHoldOverlapsExistingHold_UsingCustomDuration()
    {
        _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate, durationMinutes: 120);

        // A second hold starting 90 minutes later still falls within the first
        // hold's 120-minute occupancy window, so it should be rejected.
        HoldResult? second = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate.AddMinutes(90), durationMinutes: 120);

        Assert.Null(second);
    }

    // ── GetHold ──────────────────────────────────────────────────────────────

    [Fact]
    public void GetHold_ReturnsEntry_ForActiveHold()
    {
        HoldResult result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;

        HoldEntry? entry = _svc.GetHold(result.HoldId);

        Assert.NotNull(entry);
        Assert.Equal(_tableId, entry.TableId);
        Assert.Equal(_sectionId, entry.SectionId);
        Assert.Equal(_restaurantId, entry.RestaurantId);
    }

    [Fact]
    public void GetHold_ReturnsNull_AfterHoldExpires()
    {
        HoldResult result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _clock.Advance(HoldService.HoldDuration + TimeSpan.FromSeconds(1));

        Assert.Null(_svc.GetHold(result.HoldId));
    }

    [Fact]
    public void GetHold_ReturnsNull_ForNonExistentId()
    {
        Assert.Null(_svc.GetHold("does-not-exist"));
    }

    [Fact]
    public void GetHold_ReturnsNull_AfterRelease()
    {
        HoldResult result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;
        _svc.ReleaseHold(result.HoldId);

        Assert.Null(_svc.GetHold(result.HoldId));
    }

    // ── HoldDuration ─────────────────────────────────────────────────────────

    [Fact]
    public void HoldDuration_IsFiveMinutes()
    {
        Assert.Equal(TimeSpan.FromMinutes(5), HoldService.HoldDuration);
    }

    [Fact]
    public void PlaceHold_ExpiresAt_IsExactlyHoldDurationFromNow()
    {
        HoldResult result = _svc.PlaceHold(_restaurantId, _tableId, _sectionId, _bookingDate)!;

        Assert.Equal(_clock.UtcNow + HoldService.HoldDuration, result.ExpiresAt);
    }

    // ── PlaceAutoHold ────────────────────────────────────────────────────────

    private static readonly TableCandidate[] _twoCandidates =
    [
        new(10, 1, 2),  // smallest first
        new(11, 1, 4)
    ];

    [Fact]
    public void PlaceAutoHold_PicksFirstFreeCandidate()
    {
        AutoAssignResult? result = _svc.PlaceAutoHold(_restaurantId, _twoCandidates, _bookingDate);

        Assert.NotNull(result);
        Assert.Equal(10, result!.TableId);
        Assert.Equal(1, result.SectionId);
        Assert.NotEmpty(result.HoldId);
        Assert.Equal(_baseTime.Add(HoldService.HoldDuration), result.ExpiresAt);
    }

    [Fact]
    public void PlaceAutoHold_FallsThroughToNextCandidate_WhenFirstIsHeld()
    {
        // Hold the first candidate via the single-table path (simulating another user).
        _svc.PlaceHold(_restaurantId, tableId: 10, sectionId: 1, _bookingDate);

        AutoAssignResult? result = _svc.PlaceAutoHold(_restaurantId, _twoCandidates, _bookingDate);

        Assert.NotNull(result);
        Assert.Equal(11, result!.TableId); // fell through to the 4-seater
        Assert.Equal(1, result.SectionId);
    }

    [Fact]
    public void PlaceAutoHold_ReturnsNull_WhenAllCandidatesHeld()
    {
        _svc.PlaceHold(_restaurantId, tableId: 10, sectionId: 1, _bookingDate);
        _svc.PlaceHold(_restaurantId, tableId: 11, sectionId: 1, _bookingDate);

        AutoAssignResult? result = _svc.PlaceAutoHold(_restaurantId, _twoCandidates, _bookingDate);

        Assert.Null(result);
    }

    [Fact]
    public void PlaceAutoHold_ReturnsNull_ForEmptyCandidateList()
    {
        AutoAssignResult? result = _svc.PlaceAutoHold(_restaurantId, Array.Empty<TableCandidate>(), _bookingDate);

        Assert.Null(result);
    }

    [Fact]
    public void PlaceAutoHold_AtomicallyExcludesCallerCurrentHold_OnSameTable()
    {
        // Caller already holds T10; re-requesting auto-assign with currentHoldId must allow
        // re-acquiring the same candidate (mirrors PlaceHold's atomic-replace semantics).
        AutoAssignResult first = _svc.PlaceAutoHold(_restaurantId, _twoCandidates, _bookingDate)!;

        AutoAssignResult? second = _svc.PlaceAutoHold(
            _restaurantId, _twoCandidates, _bookingDate, currentHoldId: first.HoldId);

        Assert.NotNull(second);
        Assert.NotEqual(first.HoldId, second!.HoldId);
        Assert.Null(_svc.GetHold(first.HoldId)); // previous hold released
    }

    [Fact]
    public void PlaceAutoHold_PersistedEntry_HasChosenTableAndSection()
    {
        AutoAssignResult result = _svc.PlaceAutoHold(_restaurantId, _twoCandidates, _bookingDate)!;

        HoldEntry? entry = _svc.GetHold(result.HoldId);

        Assert.NotNull(entry);
        Assert.Equal(result.TableId, entry!.TableId);
        Assert.Equal(result.SectionId, entry.SectionId);
        Assert.Equal(_restaurantId, entry.RestaurantId);
    }

    [Fact]
    public async Task PlaceAutoHold_NeverDoubleBooksSameTable_WhenContended()
    {
        // Stress the lock: 20 concurrent auto-assign requests competing for 3 candidate tables.
        // Exactly 3 should win (one per table); the rest get null.
        var candidates = new TableCandidate[]
        {
            new(100, 1, 2),
            new(101, 1, 2),
            new(102, 1, 2)
        };
        int successes = 0;
        var winners = new System.Collections.Concurrent.ConcurrentBag<int>();

        var tasks = Enumerable.Range(0, 20).Select(_ => Task.Run(() =>
        {
            AutoAssignResult? r = _svc.PlaceAutoHold(_restaurantId, candidates, _bookingDate);
            if (r is not null)
            {
                System.Threading.Interlocked.Increment(ref successes);
                winners.Add(r.TableId);
            }
        })).ToArray();
        await Task.WhenAll(tasks);

        Assert.Equal(3, successes);                         // one winner per table
        Assert.Equal(3, winners.Distinct().Count());        // no two winners share a table
    }
}
