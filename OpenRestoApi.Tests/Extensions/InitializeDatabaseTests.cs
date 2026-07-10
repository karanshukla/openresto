using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Extensions;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Extensions;

/// <summary>
/// Exercises <see cref="DatabaseExtensions.InitializeDatabase"/> end-to-end against real
/// file-backed SQLite databases (rather than mocks) since its logic — directory bootstrap,
/// legacy-migration-history remap, WAL diagnostics — is all raw ADO.NET/filesystem work that
/// only a real database file can meaningfully exercise.
/// </summary>
public sealed class InitializeDatabaseTests : IDisposable
{
    private readonly string _tempDir;

    public InitializeDatabaseTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "openresto-db-tests-" + Guid.NewGuid().ToString("N"));
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_tempDir))
                Directory.Delete(_tempDir, recursive: true);
        }
        catch
        {
            // best-effort cleanup
        }
        GC.SuppressFinalize(this);
    }

    private static WebApplication BuildApp(string connectionString, Dictionary<string, string?>? configValues = null)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        if (configValues != null)
            builder.Configuration.AddInMemoryCollection(configValues);
        builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(connectionString));
        builder.Services.AddScoped<IPasswordService, PasswordService>();
        return builder.Build();
    }

    // ── Fresh install ──────────────────────────────────────────────────────────

    [Fact]
    public async Task FreshInstall_CreatesMissingDirectory_AndSeedsAdmin_FromConfigValues()
    {
        string dbFile = Path.Combine(_tempDir, "sub", "openresto.db");
        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "config-admin@openresto.com",
            ["Admin:Password"] = "config-password",
        });

        app.InitializeDatabase(connectionString, app.Configuration);

        Assert.True(Directory.Exists(Path.Combine(_tempDir, "sub")));
        using var scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("config-admin@openresto.com", cred.Email);
    }

    [Fact]
    public async Task FreshInstall_UsesExistingWritableDirectory_AndEnvVarFallback()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString);

        Environment.SetEnvironmentVariable("ADMIN_EMAIL", "env-admin@openresto.com");
        Environment.SetEnvironmentVariable("ADMIN_PASSWORD", "env-password");
        try
        {
            app.InitializeDatabase(connectionString, app.Configuration);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", null);
            Environment.SetEnvironmentVariable("ADMIN_PASSWORD", null);
        }

        using var scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("env-admin@openresto.com", cred.Email);
    }

    [Fact]
    public void FreshInstall_Throws_WhenAdminPasswordNotConfigured()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString);

        Environment.SetEnvironmentVariable("ADMIN_PASSWORD", null);

        Assert.Throws<InvalidOperationException>(() => app.InitializeDatabase(connectionString, app.Configuration));
    }

    [Fact]
    public async Task FreshInstall_WithLeftoverWalAndShmSidecarFiles_StillSucceeds()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");

        // Create a valid empty SQLite file up front, then leave orphaned -wal/-shm
        // sidecars beside it — the scenario DiagnoseDbState's diagnostics exist to
        // capture (a previous abrupt shutdown, e.g. a dotnet-watch kill).
        using (var seedConnection = new SqliteConnection($"Data Source={dbFile}"))
        {
            seedConnection.Open();
        }
        await File.WriteAllBytesAsync(dbFile + "-wal", new byte[] { 1, 2, 3, 4 });
        await File.WriteAllBytesAsync(dbFile + "-shm", new byte[] { 5, 6, 7, 8 });

        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        app.InitializeDatabase(connectionString, app.Configuration);

        using var scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.AdminCredentials.AnyAsync());
    }

    // ── Legacy migration history remap ───────────────────────────────────────────

    private static void CreateLegacySchema(string dbFile, bool includeHistoryTable, bool recordConsolidatedMigration, bool includeCustomerNameColumn)
    {
        using var connection = new SqliteConnection($"Data Source={dbFile}");
        connection.Open();

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "CREATE TABLE AdminCredentials (Id INTEGER PRIMARY KEY, Email TEXT)";
            cmd.ExecuteNonQuery();
        }

        using (var cmd = connection.CreateCommand())
        {
            string customerNameCol = includeCustomerNameColumn ? ", CustomerName TEXT" : string.Empty;
            cmd.CommandText = $"CREATE TABLE Bookings (Id INTEGER PRIMARY KEY{customerNameCol})";
            cmd.ExecuteNonQuery();
        }

        if (includeHistoryTable)
        {
            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = @"CREATE TABLE __EFMigrationsHistory (
                    MigrationId TEXT NOT NULL CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY,
                    ProductVersion TEXT NOT NULL)";
                cmd.ExecuteNonQuery();
            }

            using var insertCmd = connection.CreateCommand();
            if (recordConsolidatedMigration)
            {
                insertCmd.CommandText = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20260530173531_InitialCreate', '10.0.0')";
            }
            else
            {
                insertCmd.CommandText = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('00000000000000_LegacyOne', '6.0.0')";
            }
            insertCmd.ExecuteNonQuery();
        }
    }

    private static async Task<bool> ColumnExistsAsync(string dbFile, string table, string column)
    {
        using var connection = new SqliteConnection($"Data Source={dbFile}");
        await connection.OpenAsync();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'";
        return (long)(await cmd.ExecuteScalarAsync() ?? 0L) > 0;
    }

    private static async Task<List<string>> GetMigrationHistoryIdsAsync(string dbFile)
    {
        using var connection = new SqliteConnection($"Data Source={dbFile}");
        await connection.OpenAsync();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT MigrationId FROM __EFMigrationsHistory";
        using var reader = await cmd.ExecuteReaderAsync();
        List<string> ids = [];
        while (await reader.ReadAsync())
            ids.Add(reader.GetString(0));
        return ids;
    }

    [Fact]
    public async Task LegacySchema_WithoutHistoryTable_StampsConsolidatedMigration_AndPatchesColumn()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        CreateLegacySchema(dbFile, includeHistoryTable: false, recordConsolidatedMigration: false, includeCustomerNameColumn: false);

        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        // The fake minimal schema doesn't match any real migration snapshot, so once the
        // remap stamps InitialCreate as "already applied", EF's subsequent migrations run
        // against a schema they don't recognise and fail — that's expected here; we only
        // care that the remap itself (assertions below) ran correctly first.
        Assert.ThrowsAny<Exception>(() => app.InitializeDatabase(connectionString, app.Configuration));

        List<string> historyIds = await GetMigrationHistoryIdsAsync(dbFile);
        Assert.Contains("20260530173531_InitialCreate", historyIds);
        Assert.True(await ColumnExistsAsync(dbFile, "Bookings", "CustomerName"));
    }

    [Fact]
    public async Task LegacySchema_WithHistoryTable_ReplacesLegacyRows_WithConsolidatedMigration()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        CreateLegacySchema(dbFile, includeHistoryTable: true, recordConsolidatedMigration: false, includeCustomerNameColumn: false);

        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        Assert.ThrowsAny<Exception>(() => app.InitializeDatabase(connectionString, app.Configuration));

        List<string> historyIds = await GetMigrationHistoryIdsAsync(dbFile);
        Assert.DoesNotContain("00000000000000_LegacyOne", historyIds);
        Assert.Contains("20260530173531_InitialCreate", historyIds);
        Assert.True(await ColumnExistsAsync(dbFile, "Bookings", "CustomerName"));
    }

    [Fact]
    public async Task LegacySchema_WithConsolidatedMigrationAlreadyRecorded_SkipsRemap_ButStillPatchesColumn()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        CreateLegacySchema(dbFile, includeHistoryTable: true, recordConsolidatedMigration: true, includeCustomerNameColumn: false);

        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        Assert.ThrowsAny<Exception>(() => app.InitializeDatabase(connectionString, app.Configuration));

        List<string> historyIds = await GetMigrationHistoryIdsAsync(dbFile);
        Assert.Single(historyIds);
        Assert.Equal("20260530173531_InitialCreate", historyIds[0]);
        Assert.True(await ColumnExistsAsync(dbFile, "Bookings", "CustomerName"));
    }
}
