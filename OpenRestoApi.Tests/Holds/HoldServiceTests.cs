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
}
