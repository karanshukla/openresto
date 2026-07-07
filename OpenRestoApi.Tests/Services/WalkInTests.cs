using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Walk-in policy tests for <see cref="WalkInHelper"/> and the admin update
/// path. Service-level rejection tests live in <see cref="BookingServiceTests"/>
/// and <see cref="AvailabilityServiceTests"/>, which are the classes allowed to
/// construct the restricted repository types.
/// </summary>
public class WalkInTests
{
    private static RestaurantManagementService CreateService(AppDbContext db) => new(
        new RestaurantRepository(db),
        new SectionRepository(db),
        new TableRepository(db),
        new BookingRepository(db));

    // ── WalkInHelper ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void ParseWalkInDays_ReturnsEmpty_ForNullOrBlank(string? input)
    {
        Assert.Empty(WalkInHelper.ParseWalkInDays(input));
    }

    [Fact]
    public void ParseWalkInDays_ParsesValidDays_AndIgnoresJunk()
    {
        HashSet<int> days = WalkInHelper.ParseWalkInDays(" 6 ,7,0,8,abc,6");
        Assert.True(days.SetEquals([6, 7]));
    }

    [Fact]
    public void NormalizeWalkInDays_SortsAndDeduplicates()
    {
        Assert.Equal("2,6,7", WalkInHelper.NormalizeWalkInDays("7, 2,6,2"));
    }

    [Fact]
    public void NormalizeWalkInDays_ReturnsNull_WhenEmpty()
    {
        Assert.Null(WalkInHelper.NormalizeWalkInDays(""));
        Assert.Null(WalkInHelper.NormalizeWalkInDays(" , "));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("8")]
    [InlineData("monday")]
    public void NormalizeWalkInDays_Throws_ForInvalidEntries(string input)
    {
        Assert.Throws<ValidationException>(() => WalkInHelper.NormalizeWalkInDays(input));
    }

    [Fact]
    public void IsWalkInOnlyAt_ReturnsTrue_WhenLocationIsWalkInOnly()
    {
        var r = new Restaurant { Name = "T", WalkInOnly = true };
        Assert.True(WalkInHelper.IsWalkInOnlyAt(r, DateTime.UtcNow));
    }

    [Fact]
    public void IsWalkInOnlyAt_ReturnsFalse_WhenNoWalkInDays()
    {
        var r = new Restaurant { Name = "T" };
        Assert.False(WalkInHelper.IsWalkInOnlyAt(r, DateTime.UtcNow));
    }

    [Fact]
    public void IsWalkInOnlyAt_UsesRestaurantTimezone_ForDayBoundary()
    {
        // Sunday 02:00 UTC is still Saturday evening in Los Angeles.
        var r = new Restaurant { Name = "T", Timezone = "America/Los_Angeles", WalkInDays = "6" };
        var sundayUtc = new DateTime(2026, 10, 11, 2, 0, 0, DateTimeKind.Utc);

        Assert.True(WalkInHelper.IsWalkInOnlyAt(r, sundayUtc));
    }

    [Fact]
    public void IsWalkInOnlyAt_FallsBackToUtc_ForUnknownTimezone()
    {
        var r = new Restaurant { Name = "T", Timezone = "Not/AZone", WalkInDays = "7" };
        var sundayUtc = new DateTime(2026, 10, 11, 12, 0, 0, DateTimeKind.Utc);

        Assert.True(WalkInHelper.IsWalkInOnlyAt(r, sundayUtc));
    }

    [Fact]
    public void IsWalkInOnlyOn_MatchesDay()
    {
        var r = new Restaurant { Name = "T", WalkInDays = "6,7" };
        Assert.True(WalkInHelper.IsWalkInOnlyOn(r, 6));
        Assert.False(WalkInHelper.IsWalkInOnlyOn(r, 3));
    }

    // ── RestaurantManagementService ───────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_SetsAndNormalizesWalkInFields()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_SetsAndNormalizesWalkInFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T" });
        db.SaveChanges();

        var svc = CreateService(db);
        RestaurantDto? dto = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "T",
            WalkInOnly = true,
            WalkInDays = "7, 6"
        });

        Assert.NotNull(dto);
        Assert.True(dto.WalkInOnly);
        Assert.Equal("6,7", dto.WalkInDays);

        Restaurant? entity = await db.Restaurants.FindAsync(1);
        Assert.True(entity!.WalkInOnly);
        Assert.Equal("6,7", entity.WalkInDays);
    }

    [Fact]
    public async Task UpdateAsync_ClearsWalkInDays_WithEmptyString()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_ClearsWalkInDays_WithEmptyString));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", WalkInOnly = true, WalkInDays = "6,7" });
        db.SaveChanges();

        var svc = CreateService(db);
        RestaurantDto? dto = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "T",
            WalkInOnly = false,
            WalkInDays = ""
        });

        Assert.NotNull(dto);
        Assert.False(dto.WalkInOnly);
        Assert.Equal("", dto.WalkInDays);

        Restaurant? entity = await db.Restaurants.FindAsync(1);
        Assert.False(entity!.WalkInOnly);
        Assert.Null(entity.WalkInDays);
    }

    [Fact]
    public async Task UpdateAsync_Throws_ForInvalidWalkInDays()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Throws_ForInvalidWalkInDays));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T" });
        db.SaveChanges();

        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "T",
            WalkInDays = "8"
        }));
    }

    [Fact]
    public async Task UpdateAsync_LeavesWalkInFieldsUntouched_WhenOmitted()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_LeavesWalkInFieldsUntouched_WhenOmitted));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", WalkInOnly = true, WalkInDays = "6" });
        db.SaveChanges();

        var svc = CreateService(db);
        RestaurantDto? dto = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "T2" });

        Assert.NotNull(dto);
        Assert.True(dto.WalkInOnly);
        Assert.Equal("6", dto.WalkInDays);
    }

    [Fact]
    public async Task GetByIdAsync_ExposesWalkInFields()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ExposesWalkInFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", WalkInDays = "6,7" });
        db.SaveChanges();

        var svc = CreateService(db);
        RestaurantDto? dto = await svc.GetByIdAsync(1);

        Assert.NotNull(dto);
        Assert.False(dto.WalkInOnly);
        Assert.Equal("6,7", dto.WalkInDays);
    }
}
