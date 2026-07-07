using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.TestInfrastructure;

/// <summary>
/// Tests for the test infrastructure helpers themselves. They become load-bearing
/// once ~14 service test files depend on them, so they warrant their own coverage.
/// </summary>
public class TestDbFactoryTests
{
    [Fact]
    public void Create_ReturnsUsableDbContext()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Create_ReturnsUsableDbContext));

        // A writable DbSet round-trip proves the context is functional.
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "X" });
        db.SaveChanges();

        Assert.Equal(1, db.Restaurants.Count());
    }

    [Fact]
    public void Create_WithDistinctNames_YieldsIsolatedDatabases()
    {
        // Two distinct names must not share state — the whole point of per-test naming.
        using AppDbContext dbA = TestDbFactory.Create(nameof(Create_WithDistinctNames_YieldsIsolatedDatabases) + "_A");
        using AppDbContext dbB = TestDbFactory.Create(nameof(Create_WithDistinctNames_YieldsIsolatedDatabases) + "_B");

        dbA.Restaurants.Add(new Restaurant { Id = 1, Name = "A" });
        dbA.SaveChanges();

        Assert.Single(dbA.Restaurants);
        Assert.Empty(dbB.Restaurants);
    }

    [Fact]
    public void BasicRestaurant_SeedsSingleTableGraph()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(BasicRestaurant_SeedsSingleTableGraph));

        TestSeed.BasicRestaurant(db);

        Assert.Single(db.Restaurants);
        Assert.Single(db.Sections);
        Table table = Assert.Single(db.Tables);
        Assert.Equal(4, table.Seats);
        // BasicRestaurant doesn't override opening hours — the Restaurant entity's
        // own defaults ("00:00"/"23:59") apply, distinguishing it from RestaurantWithHours.
        Assert.Equal("00:00", db.Restaurants.First().OpenTime);
    }

    [Fact]
    public void RestaurantWithHours_SeedsTwoTablesAndOpeningHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RestaurantWithHours_SeedsTwoTablesAndOpeningHours));

        TestSeed.RestaurantWithHours(db);

        Restaurant r = db.Restaurants.First();
        Assert.Equal("11:00", r.OpenTime);
        Assert.Equal("13:00", r.CloseTime);
        Assert.Equal("UTC", r.Timezone);
        Assert.Equal(2, db.Tables.Count());
    }

    [Fact]
    public void RestaurantWithHours_AcceptsCustomHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RestaurantWithHours_AcceptsCustomHours));

        TestSeed.RestaurantWithHours(db, open: "09:00", close: "22:00", tz: "America/New_York");

        Restaurant r = db.Restaurants.First();
        Assert.Equal("09:00", r.OpenTime);
        Assert.Equal("22:00", r.CloseTime);
        Assert.Equal("America/New_York", r.Timezone);
    }
}
