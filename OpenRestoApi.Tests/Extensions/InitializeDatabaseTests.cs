using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
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

    // ── Connection string parsing ────────────────────────────────────────────────

    [Fact]
    public async Task ConnectionStringWithExtraOptions_ExtractsDataSourceBeforeSemicolon()
    {
        string dbFile = Path.Combine(_tempDir, "sub", "openresto.db");
        string connectionString = $"Data Source={dbFile};Cache=Shared";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        app.InitializeDatabase(connectionString, app.Configuration);

        Assert.True(Directory.Exists(Path.Combine(_tempDir, "sub")));
        using var scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.AdminCredentials.AnyAsync());
    }

    // ── Directory bootstrap failure paths ────────────────────────────────────────

    [Fact]
    public void DirectoryCreationFailure_IsLogged_AndInitializationContinues()
    {
        // Make the parent path segment a plain file so Directory.CreateDirectory throws
        // for the "sub" segment underneath it — the scenario LogFailedToCreateDbDirectory
        // exists to record.
        Directory.CreateDirectory(_tempDir);
        string blockerFile = Path.Combine(_tempDir, "blocker");
        File.WriteAllText(blockerFile, "not a directory");
        string dbFile = Path.Combine(_tempDir, "blocker", "sub", "openresto.db");
        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        // The directory can never be created, so Migrate() eventually fails too — we only
        // care that the mkdir failure itself is caught and logged rather than crashing the
        // whole diagnostics block outright.
        Assert.ThrowsAny<Exception>(() => app.InitializeDatabase(connectionString, app.Configuration));
    }

    [Fact]
    public void ExistingDirectoryNotWritable_IsLogged_AndInitializationContinues()
    {
        // /proc exists but refuses ordinary file creation even for root — a portable stand-in
        // for a permission-denied data directory (the case LogDbDirectoryNotWritable covers).
        string dbFile = "/proc/openresto-not-writable-test.db";
        string connectionString = $"Data Source={dbFile}";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        Assert.ThrowsAny<Exception>(() => app.InitializeDatabase(connectionString, app.Configuration));
    }

    // ── Legacy migration remap: transaction failure ──────────────────────────────

    [Fact]
    public void RemapLegacyMigrationHistory_RollsBackAndLogsWarning_WhenTransactionStatementFails()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");

        // __EFMigrationsHistory is a VIEW rather than a TABLE, so sqlite_master's type='table'
        // check treats it as "history table doesn't exist" — the remap then tries to
        // `CREATE TABLE IF NOT EXISTS __EFMigrationsHistory`, which collides with the existing
        // view and fails ("there is already an object named ..."). This happens *inside* the
        // remap's own transaction (unlike a lock-contention failure, which fails earlier at
        // BeginTransaction itself, since Microsoft.Data.Sqlite's default BeginTransaction()
        // issues BEGIN IMMEDIATE and so already owns the write lock by the time the try block
        // is reached) — exercising the inner rollback+rethrow and the outer "non-fatal,
        // proceeding anyway" catch.
        using (SqliteConnection seed = new($"Data Source={dbFile}"))
        {
            seed.Open();
            using SqliteCommand cmd = seed.CreateCommand();
            cmd.CommandText = "CREATE TABLE AdminCredentials (Id INTEGER PRIMARY KEY)";
            cmd.ExecuteNonQuery();
            cmd.CommandText = "CREATE TABLE Bookings (Id INTEGER PRIMARY KEY, CustomerName TEXT)";
            cmd.ExecuteNonQuery();
            cmd.CommandText = "CREATE VIEW __EFMigrationsHistory AS SELECT 'x' AS MigrationId, 'y' AS ProductVersion";
            cmd.ExecuteNonQuery();
        }

        string connectionString = $"Data Source={dbFile}";
        using AppDbContext db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connectionString).Options);

        MethodInfo method = typeof(DatabaseExtensions).GetMethod("RemapLegacyMigrationHistory", BindingFlags.NonPublic | BindingFlags.Static)!;
        Exception? ex = Record.Exception(() => method.Invoke(null, [db, NullLogger.Instance]));

        // Non-fatal by design: the failure is caught and logged, not propagated.
        Assert.Null(ex);

        // The view must survive untouched — the failed CREATE TABLE was rolled back.
        using SqliteConnection verify = new(connectionString);
        verify.Open();
        using SqliteCommand verifyCmd = verify.CreateCommand();
        verifyCmd.CommandText = "SELECT type FROM sqlite_master WHERE name = '__EFMigrationsHistory'";
        Assert.Equal("view", verifyCmd.ExecuteScalar());
    }

    // ── Retry loop ────────────────────────────────────────────────────────────────

    [Fact]
    public void Migrate_RetriesOnBusy_ThenRethrows_AfterExhaustingAllAttempts()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "openresto.db");
        using (SqliteConnection seed = new($"Data Source={dbFile}"))
        {
            seed.Open();
        }

        // Default Timeout=1 disables SQLite's internal busy-wait (30s by default) so each of
        // the 10 retry attempts below fails immediately with SQLITE_BUSY — the loop's own
        // explicit 2s sleep between attempts is the only intentional delay.
        string connectionString = $"Data Source={dbFile};Default Timeout=1";
        using WebApplication app = BuildApp(connectionString, new Dictionary<string, string?>
        {
            ["Admin:Email"] = "admin@openresto.com",
            ["Admin:Password"] = "password123",
        });

        // Hold an uncommitted write transaction on a second connection for the whole call so
        // every one of Migrate()'s attempts hits SQLITE_BUSY, driving the retry loop through
        // all 10 attempts and its final rethrow.
        using SqliteConnection lockConnection = new(connectionString);
        lockConnection.Open();
        using SqliteTransaction lockTx = lockConnection.BeginTransaction();
        using (SqliteCommand lockCmd = lockConnection.CreateCommand())
        {
            lockCmd.Transaction = lockTx;
            lockCmd.CommandText = "CREATE TABLE LockHolder (Id INTEGER)";
            lockCmd.ExecuteNonQuery();
        }

        Exception? ex = Record.Exception(() => app.InitializeDatabase(connectionString, app.Configuration));

        Assert.NotNull(ex);
    }

    // ── DiagnoseDbState ───────────────────────────────────────────────────────────

    private static void InvokeDiagnoseDbState(AppDbContext db, string? dbFile, ILogger logger)
    {
        MethodInfo method = typeof(DatabaseExtensions).GetMethod("DiagnoseDbState", BindingFlags.NonPublic | BindingFlags.Static)!;
        method.Invoke(null, [db, dbFile, logger]);
    }

    [Fact]
    public void DiagnoseDbState_LogsErrors_WhenQueriesFail_OnUnreadableFile()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "not-a-database.db");
        // A file that isn't a valid SQLite database at all: both PRAGMA journal_mode and
        // PRAGMA integrity_check fail against it, exercising both diagnostic catch blocks.
        File.WriteAllBytes(dbFile, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        using AppDbContext db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={dbFile}").Options);

        Exception? ex = Record.Exception(() => InvokeDiagnoseDbState(db, dbFile, NullLogger.Instance));

        Assert.Null(ex);
    }

    [Fact]
    public void DiagnoseDbState_LogsFailure_WhenIntegrityCheckReportsCorruption()
    {
        Directory.CreateDirectory(_tempDir);
        string dbFile = Path.Combine(_tempDir, "corrupted.db");

        using (SqliteConnection seed = new($"Data Source={dbFile}"))
        {
            seed.Open();
            using SqliteCommand create = seed.CreateCommand();
            create.CommandText = "CREATE TABLE Padding (Id INTEGER PRIMARY KEY, Data TEXT)";
            create.ExecuteNonQuery();

            using SqliteTransaction tx = seed.BeginTransaction();
            using SqliteCommand insert = seed.CreateCommand();
            insert.Transaction = tx;
            insert.CommandText = "INSERT INTO Padding (Data) VALUES (@d)";
            SqliteParameter param = insert.CreateParameter();
            param.ParameterName = "@d";
            insert.Parameters.Add(param);
            string filler = new('x', 500);
            for (int i = 0; i < 500; i++)
            {
                param.Value = filler + i;
                insert.ExecuteNonQuery();
            }

            tx.Commit();
        }

        // Corrupt bytes well past the header/first page so the file still opens, but a data
        // page fails the b-tree structural check.
        long fileLength = new FileInfo(dbFile).Length;
        Assert.True(fileLength > 8192, "expected the seeded table to span multiple SQLite pages");
        using (FileStream stream = new(dbFile, FileMode.Open, FileAccess.Write, FileShare.None))
        {
            stream.Seek(6000, SeekOrigin.Begin);
            byte[] garbage = new byte[200];
            Array.Fill(garbage, (byte)0xFF);
            stream.Write(garbage);
        }

        using AppDbContext db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={dbFile}").Options);

        Exception? ex = Record.Exception(() => InvokeDiagnoseDbState(db, dbFile, NullLogger.Instance));

        Assert.Null(ex);
    }
}
