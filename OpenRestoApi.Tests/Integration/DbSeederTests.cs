using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class DbSeederTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public DbSeederTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    [Fact]
    public void Seed_CreatesRestaurants_WhenDbIsEmpty()
    {
        using var db = CreateContext();

        DbSeeder.Seed(db);

        var restaurants = db.Restaurants.ToList();
        Assert.Equal(2, restaurants.Count);
        Assert.Contains(restaurants, r => r.Name == "Pasta Place");
        Assert.Contains(restaurants, r => r.Name == "Sushi Spot");
    }

    [Fact]
    public void Seed_IsIdempotent_CallingTwiceDoesNotDuplicate()
    {
        using var db = CreateContext();

        DbSeeder.Seed(db);
        DbSeeder.Seed(db);

        var restaurants = db.Restaurants.ToList();
        Assert.Equal(2, restaurants.Count);
    }

    [Fact]
    public void Seed_CreatesCorrectSectionsAndTables()
    {
        using var db = CreateContext();

        DbSeeder.Seed(db);

        var pastaPlace = db.Restaurants
            .Include(r => r.Sections)
            .ThenInclude(s => s.Tables)
            .First(r => r.Name == "Pasta Place");

        Assert.Equal(2, pastaPlace.Sections.Count);

        var indoor = pastaPlace.Sections.First(s => s.Name == "Indoor");
        Assert.Equal(2, indoor.Tables.Count);
        Assert.Contains(indoor.Tables, t => t.Name == "T1" && t.Seats == 4);
        Assert.Contains(indoor.Tables, t => t.Name == "T2" && t.Seats == 2);

        var patio = pastaPlace.Sections.First(s => s.Name == "Patio");
        Assert.Single(patio.Tables);
        Assert.Contains(patio.Tables, t => t.Name == "P1" && t.Seats == 4);

        var sushiSpot = db.Restaurants
            .Include(r => r.Sections)
            .ThenInclude(s => s.Tables)
            .First(r => r.Name == "Sushi Spot");

        Assert.Single(sushiSpot.Sections);

        var bar = sushiSpot.Sections.First(s => s.Name == "Bar");
        Assert.Equal(2, bar.Tables.Count);
        Assert.Contains(bar.Tables, t => t.Name == "B1" && t.Seats == 2);
        Assert.Contains(bar.Tables, t => t.Name == "B2" && t.Seats == 2);
    }
}
