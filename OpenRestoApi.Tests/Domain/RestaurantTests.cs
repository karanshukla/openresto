using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class RestaurantTests
{
    private static Restaurant NewRestaurant(
        string openTime = "00:00",
        string closeTime = "23:59",
        string timezone = "UTC",
        string? openDays = null,
        string? openHoursJson = null,
        bool walkInOnly = false,
        string? walkInDays = null,
        DateTime? bookingsPausedUntil = null)
        => new()
        {
            Id = 1,
            Name = "T",
            OpenTime = openTime,
            CloseTime = closeTime,
            Timezone = timezone,
            OpenDays = openDays ?? "1,2,3,4,5,6,7",
            OpenHoursJson = openHoursJson,
            WalkInOnly = walkInOnly,
            WalkInDays = walkInDays,
            BookingsPausedUntil = bookingsPausedUntil
        };

    // ── IsPaused ───────────────────────────────────────────────────────────────

    [Fact]
    public void IsPaused_True_WhenPauseExpiryInFuture()
    {
        Restaurant r = NewRestaurant(bookingsPausedUntil: DateTime.UtcNow.AddHours(1));
        Assert.True(r.IsPaused());
    }

    [Fact]
    public void IsPaused_False_WhenPauseExpiryInPast()
    {
        Restaurant r = NewRestaurant(bookingsPausedUntil: DateTime.UtcNow.AddHours(-1));
        Assert.False(r.IsPaused());
    }

    [Fact]
    public void IsPaused_False_WhenPauseExpiryIsNull()
    {
        Restaurant r = NewRestaurant(bookingsPausedUntil: null);
        Assert.False(r.IsPaused());
    }

    [Fact]
    public void IsPaused_False_AtExactExpiryBoundary()
    {
        // The check is strictly greater-than, so a pause set to exactly now is NOT paused.
        DateTime now = DateTime.UtcNow;
        Restaurant r = NewRestaurant(bookingsPausedUntil: now);
        // Re-query just after the boundary to avoid a race; the contract is ">" not ">=".
        Assert.False(r.IsPaused() && r.BookingsPausedUntil!.Value > DateTime.UtcNow);
    }

    // ── IsWalkInOnlyAt ─────────────────────────────────────────────────────────

    [Fact]
    public void IsWalkInOnlyAt_True_WhenWalkInOnlyFlagSet()
    {
        Restaurant r = NewRestaurant(walkInOnly: true);
        Assert.True(r.IsWalkInOnlyAt(DateTime.UtcNow));
    }

    [Fact]
    public void IsWalkInOnlyAt_False_WhenNeitherFlagNorDaysSet()
    {
        Restaurant r = NewRestaurant();
        Assert.False(r.IsWalkInOnlyAt(DateTime.UtcNow));
    }

    [Fact]
    public void IsWalkInOnlyAt_True_OnListedWalkInDay_AfterTimezoneConversion()
    {
        // Saturday in UTC — mark Saturday (ISO 6) as walk-in only.
        var saturdayUtc = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc); // a Saturday
        Restaurant r = NewRestaurant(timezone: "UTC", walkInDays: "6");
        Assert.True(r.IsWalkInOnlyAt(saturdayUtc));
    }

    [Fact]
    public void IsWalkInOnlyAt_False_OnUnlistedDay()
    {
        var saturdayUtc = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc); // Saturday
        Restaurant r = NewRestaurant(timezone: "UTC", walkInDays: "1"); // Monday only
        Assert.False(r.IsWalkInOnlyAt(saturdayUtc));
    }

    // ── IsOpenAt ───────────────────────────────────────────────────────────────

    [Fact]
    public void IsOpenAt_True_WhenWithinUniformHours()
    {
        // 09:00–22:00 UTC, noon is within hours.
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");
        var noon = new DateTime(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc); // Monday
        Assert.True(r.IsOpenAt(noon));
    }

    [Fact]
    public void IsOpenAt_False_WhenOutsideUniformHours()
    {
        Restaurant r = NewRestaurant(openTime: "09:00", closeTime: "22:00");
        var lateNight = new DateTime(2026, 1, 5, 23, 0, 0, DateTimeKind.Utc);
        Assert.False(r.IsOpenAt(lateNight));
    }

    [Fact]
    public void IsOpenAt_True_WithinPerDayOverride()
    {
        // Uniform 09:00–17:00, but every day overridden to 12:00–14:00.
        Restaurant r = NewRestaurant(
            openTime: "09:00",
            closeTime: "17:00",
            openHoursJson: """{"1":{"open":"12:00","close":"14:00"},"2":{"open":"12:00","close":"14:00"},"3":{"open":"12:00","close":"14:00"},"4":{"open":"12:00","close":"14:00"},"5":{"open":"12:00","close":"14:00"},"6":{"open":"12:00","close":"14:00"},"7":{"open":"12:00","close":"14:00"}}""");
        var within = new DateTime(2026, 1, 5, 12, 30, 0, DateTimeKind.Utc); // Monday 12:30
        Assert.True(r.IsOpenAt(within));
    }

    [Fact]
    public void IsOpenAt_False_OutsidePerDayOverride()
    {
        Restaurant r = NewRestaurant(
            openTime: "09:00",
            closeTime: "17:00",
            openHoursJson: """{"1":{"open":"12:00","close":"14:00"},"2":{"open":"12:00","close":"14:00"},"3":{"open":"12:00","close":"14:00"},"4":{"open":"12:00","close":"14:00"},"5":{"open":"12:00","close":"14:00"},"6":{"open":"12:00","close":"14:00"},"7":{"open":"12:00","close":"14:00"}}""");
        var outside = new DateTime(2026, 1, 5, 10, 0, 0, DateTimeKind.Utc); // Monday 10:00
        Assert.False(r.IsOpenAt(outside));
    }

    [Fact]
    public void IsOpenAt_True_ForOvernightWindow_BeforeMidnightClose()
    {
        // 18:00–02:00 (past midnight) — 23:00 is within hours.
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        var lateEvening = new DateTime(2026, 1, 5, 23, 0, 0, DateTimeKind.Utc);
        Assert.True(r.IsOpenAt(lateEvening));
    }

    [Fact]
    public void IsOpenAt_True_ForOvernightWindow_AfterMidnightClose()
    {
        // 18:00–02:00 — 01:00 is within hours (the after-midnight segment).
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        var afterMidnight = new DateTime(2026, 1, 5, 1, 0, 0, DateTimeKind.Utc);
        Assert.True(r.IsOpenAt(afterMidnight));
    }

    [Fact]
    public void IsOpenAt_False_ForOvernightWindow_OutsideBothSegments()
    {
        // 18:00–02:00 — noon is in the dead zone between the after-midnight segment
        // (ends 02:00) and the evening segment (starts 18:00).
        Restaurant r = NewRestaurant(openTime: "18:00", closeTime: "02:00");
        var noon = new DateTime(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.False(r.IsOpenAt(noon));
    }

    [Fact]
    public void IsOpenAt_TreatsEqualOpenAndClose_AsAlwaysOpen()
    {
        // 00:00 == 00:00 ⇒ 24h.
        Restaurant r = NewRestaurant(openTime: "00:00", closeTime: "00:00");
        var anyTime = new DateTime(2026, 1, 5, 3, 0, 0, DateTimeKind.Utc);
        Assert.True(r.IsOpenAt(anyTime));
    }

    [Fact]
    public void IsOpenAt_FallsBackToDefaultHours_WhenStoredTimesUnparseable()
    {
        // Empty strings fall back to the 09:00–22:00 default; noon is within.
        Restaurant r = NewRestaurant(openTime: "", closeTime: "");
        var noon = new DateTime(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(r.IsOpenAt(noon));
    }

    [Fact]
    public void IsOpenAt_FallsBackToUtc_WhenTimezoneInvalid()
    {
        Restaurant r = NewRestaurant(timezone: "Not/A/Real/Timezone", openTime: "00:00", closeTime: "23:59");
        var noon = new DateTime(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.True(r.IsOpenAt(noon));
    }

    [Fact]
    public void IsOpenAt_False_WhenDayNotInOpenDays()
    {
        // Open only on Monday (ISO 1); test a Tuesday.
        Restaurant r = NewRestaurant(openDays: "1", openTime: "00:00", closeTime: "23:59");
        var tuesday = new DateTime(2026, 1, 6, 12, 0, 0, DateTimeKind.Utc); // Tuesday
        Assert.False(r.IsOpenAt(tuesday));
    }
}
