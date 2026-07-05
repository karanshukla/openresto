using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Migrations;

/// <summary>
/// Proves the AddSectionSortOrder migration (#178) produces correct schema/data both on a
/// fresh install (Migrate() from an empty database) and on an upgrade from the last
/// pre-SortOrder migration with pre-existing Section rows that need a sequential backfill.
/// </summary>
public class SectionSortOrderMigrationTests : IDisposable
{
    private const string LastMigrationBeforeSortOrder = "20260703120000_AddSocialLinksTable";

    private readonly SqliteConnection _connection;

    public SectionSortOrderMigrationTests()
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
    public async Task FreshInstall_CreatesSortOrderColumn_AsNotNullInteger()
    {
        using AppDbContext db = CreateContext();

        await db.Database.MigrateAsync();

        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "PRAGMA table_info(Sections);";
        using var reader = await cmd.ExecuteReaderAsync();

        bool foundColumn = false;
        while (await reader.ReadAsync())
        {
            if (reader.GetString(1) == "SortOrder")
            {
                foundColumn = true;
                Assert.Equal("INTEGER", reader.GetString(2));
                Assert.Equal(1L, reader.GetInt64(3)); // notnull = 1
            }
        }

        Assert.True(foundColumn, "Sections.SortOrder column should exist after a fresh Migrate().");
    }

    [Fact]
    public async Task FreshInstall_NewSectionsDefaultToZero_WhenNotExplicitlySet()
    {
        using AppDbContext db = CreateContext();
        await db.Database.MigrateAsync();

        using var insert = _connection.CreateCommand();
        insert.CommandText = @"
            INSERT INTO Restaurants (Name, OpenTime, CloseTime, OpenDays, Timezone) VALUES ('R', '09:00', '22:00', '1,2,3,4,5,6,7', 'UTC');
            INSERT INTO Sections (Name, RestaurantId) VALUES ('NoExplicitSortOrder', last_insert_rowid());";
        await insert.ExecuteNonQueryAsync();

        using var query = _connection.CreateCommand();
        query.CommandText = "SELECT SortOrder FROM Sections WHERE Name = 'NoExplicitSortOrder';";
        object? value = await query.ExecuteScalarAsync();

        Assert.Equal(0L, Convert.ToInt64(value));
    }

    [Fact]
    public async Task Upgrade_BackfillsSequentialSortOrder_PerRestaurant_OrderedById()
    {
        using AppDbContext db = CreateContext();
        IMigrator migrator = db.GetInfrastructure().GetRequiredService<IMigrator>();

        // Bring the schema to the last pre-SortOrder migration, matching a real upgrade.
        await migrator.MigrateAsync(LastMigrationBeforeSortOrder);

        // Insert legacy data directly via the pre-migration schema (no SortOrder column yet),
        // simulating restaurants/sections that already existed before the upgrade.
        using (var insert = _connection.CreateCommand())
        {
            insert.CommandText = @"
                INSERT INTO Restaurants (Id, Name, OpenTime, CloseTime, OpenDays, Timezone) VALUES (1, 'R1', '09:00', '22:00', '1,2,3,4,5,6,7', 'UTC');
                INSERT INTO Restaurants (Id, Name, OpenTime, CloseTime, OpenDays, Timezone) VALUES (2, 'R2', '09:00', '22:00', '1,2,3,4,5,6,7', 'UTC');

                INSERT INTO Sections (Id, Name, RestaurantId) VALUES (5, 'R1-Third', 1);
                INSERT INTO Sections (Id, Name, RestaurantId) VALUES (2, 'R1-First', 1);
                INSERT INTO Sections (Id, Name, RestaurantId) VALUES (8, 'R1-Second', 1);

                INSERT INTO Sections (Id, Name, RestaurantId) VALUES (3, 'R2-First', 2);
                INSERT INTO Sections (Id, Name, RestaurantId) VALUES (9, 'R2-Second', 2);";
            await insert.ExecuteNonQueryAsync();
        }

        // Apply the remaining migrations, including AddSectionSortOrder's backfill.
        await migrator.MigrateAsync();

        using var query = _connection.CreateCommand();
        query.CommandText = "SELECT Id, Name, RestaurantId, SortOrder FROM Sections ORDER BY RestaurantId, Id;";
        using var reader = await query.ExecuteReaderAsync();

        var rows = new List<(int Id, string Name, int RestaurantId, int SortOrder)>();
        while (await reader.ReadAsync())
        {
            rows.Add((reader.GetInt32(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3)));
        }

        // Restaurant 1 sections, ordered by Id (2, 5, 8), should get sequential 0,1,2.
        Assert.Equal(0, rows.Single(r => r.Id == 2).SortOrder);
        Assert.Equal(1, rows.Single(r => r.Id == 5).SortOrder);
        Assert.Equal(2, rows.Single(r => r.Id == 8).SortOrder);

        // Restaurant 2's backfill is independent (partitioned), also starting at 0.
        Assert.Equal(0, rows.Single(r => r.Id == 3).SortOrder);
        Assert.Equal(1, rows.Single(r => r.Id == 9).SortOrder);
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

        // Path B: upgrade — migrate to the last pre-SortOrder migration, then the rest.
        using AppDbContext upgradeDb = CreateContext();
        IMigrator migrator = upgradeDb.GetInfrastructure().GetRequiredService<IMigrator>();
        await migrator.MigrateAsync(LastMigrationBeforeSortOrder);
        await migrator.MigrateAsync();

        Assert.Equal(GetSectionsSchema(freshConnection), GetSectionsSchema(_connection));
    }

    private static string GetSectionsSchema(SqliteConnection connection)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Sections';";
        return (string)(cmd.ExecuteScalar() ?? throw new InvalidOperationException("Sections table not found."));
    }
}
