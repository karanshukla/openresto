using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Migrations;

/// <summary>
/// Proves the AddRestaurantMaxTableOversizeSeats migration (#244) produces a correct nullable
/// INTEGER column both on a fresh install (Migrate() from empty) and on an upgrade from the
/// prior migration, and that the two schemas match exactly (the repo's migration-safety
/// invariant enforced by migration-check.yml).
/// </summary>
public class MaxTableOversizeSeatsMigrationTests : IDisposable
{
    private const string LastMigrationBeforeOversize = "20260719220106_AddBookingSlotIntervalMinutes";

    private readonly SqliteConnection _connection;

    public MaxTableOversizeSeatsMigrationTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    public void Dispose()
    {
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    private AppDbContext CreateContext()
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task FreshInstall_CreatesNullableIntegerColumn()
    {
        using AppDbContext db = CreateContext();
        await db.Database.MigrateAsync();

        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "PRAGMA table_info(Restaurants);";
        using var reader = await cmd.ExecuteReaderAsync();

        bool foundColumn = false;
        while (await reader.ReadAsync())
        {
            if (reader.GetString(1) == "MaxTableOversizeSeats")
            {
                foundColumn = true;
                Assert.Equal("INTEGER", reader.GetString(2));
                Assert.Equal(0L, reader.GetInt64(3)); // notnull = 0 → nullable (null = "off")
            }
        }

        Assert.True(foundColumn, "Restaurants.MaxTableOversizeSeats column should exist after a fresh Migrate().");
    }

    [Fact]
    public async Task Upgrade_ProducesSameSchema_AsFreshInstall()
    {
        // Path A: fresh install, all migrations at once.
        using var freshConnection = new SqliteConnection("Data Source=:memory:");
        freshConnection.Open();
        using (var freshDb = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(freshConnection).Options))
        {
            await freshDb.Database.MigrateAsync();
        }

        // Path B: upgrade — migrate to the last pre-oversize migration, then the rest.
        using AppDbContext upgradeDb = CreateContext();
        IMigrator migrator = upgradeDb.GetInfrastructure().GetRequiredService<IMigrator>();
        await migrator.MigrateAsync(LastMigrationBeforeOversize);
        await migrator.MigrateAsync();

        Assert.Equal(GetRestaurantsSchema(freshConnection), GetRestaurantsSchema(_connection));
    }

    private static string GetRestaurantsSchema(SqliteConnection connection)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Restaurants';";
        return (string)(cmd.ExecuteScalar() ?? throw new InvalidOperationException("Restaurants table not found."));
    }
}
