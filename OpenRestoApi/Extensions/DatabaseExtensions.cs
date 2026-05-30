using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Extensions;

public static partial class DatabaseExtensions
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Startup Diagnostics:")]
    private static partial void LogStartupDiagnostics(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Connection String: {ConnectionString}")]
    private static partial void LogConnectionString(ILogger logger, string connectionString);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Current User: {User}")]
    private static partial void LogCurrentUser(ILogger logger, string user);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Resolved DB Path: {Path}")]
    private static partial void LogResolvedDbPath(ILogger logger, string path);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - DB Directory: {Dir} (Exists: {Exists})")]
    private static partial void LogDbDirectoryInfo(ILogger logger, string dir, bool exists);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - DB Directory is writable.")]
    private static partial void LogDbDirectoryWritable(ILogger logger);

    [LoggerMessage(Level = LogLevel.Error, Message = "  - DB Directory IS NOT WRITABLE: {Message}")]
    private static partial void LogDbDirectoryNotWritable(ILogger logger, string message);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Created DB Directory: {Dir}")]
    private static partial void LogCreatedDbDirectory(ILogger logger, string dir);

    [LoggerMessage(Level = LogLevel.Error, Message = "  - Failed to create DB Directory: {Message}")]
    private static partial void LogFailedToCreateDbDirectory(ILogger logger, string message);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Database volume not yet writable/available (SQLite Error {ErrorCode}). Retry {RetryCount}/{MaxRetries} in {Delay}ms...")]
    private static partial void LogDatabaseRetry(ILogger logger, int errorCode, int retryCount, int maxRetries, int delay);

    [LoggerMessage(Level = LogLevel.Critical, Message = "FATAL ERROR during database initialization. The application cannot start.")]
    private static partial void LogFatalError(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Legacy migration history detected. Remapping {Count} old migration(s) to consolidated InitialCreate.")]
    private static partial void LogMigrationRemap(ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Information, Message = "  - Migration history is already up to date. No remap needed.")]
    private static partial void LogMigrationRemapSkipped(ILogger logger);

    private const string ConsolidatedMigrationId = "20260530173531_InitialCreate";

    // Migration IDs that existed before the history was squashed into InitialCreate.
    private static readonly string[] LegacyMigrationIds =
    [
        "20260129132410_AddSectionsAndTables",
        "20260131215731_AddBookingsTable",
        "20260503001441_AddRestaurantPauseUntil",
        "20260518000001_AddBookingSearchIndexes",
        "20260524000001_AddSendBookingConfirmations",
        "20260524000002_AddMediaImageUrls",
        "20260525213129_AddEmailFailures",
    ];

    private static void RemapLegacyMigrationHistory(AppDbContext db, ILogger logger)
    {
        // Only attempt this if the DB already exists (i.e. the history table exists).
        if (!db.Database.CanConnect())
            return;

        try
        {
            // Check whether the history table even exists before querying it.
            var tableExists = db.Database.ExecuteSqlRaw(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='__EFMigrationsHistory'") >= 0;

            // Use raw SQL so we don't depend on the EF migration infrastructure itself.
            var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                connection.Open();

            using var checkCmd = connection.CreateCommand();
            checkCmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='__EFMigrationsHistory'";
            var tableCount = (long)(checkCmd.ExecuteScalar() ?? 0L);
            if (tableCount == 0)
                return; // fresh install — nothing to remap

            // Count how many legacy migration IDs are present.
            var placeholders = string.Join(",", LegacyMigrationIds.Select((_, i) => $"@p{i}"));
            using var countCmd = connection.CreateCommand();
            countCmd.CommandText = $"SELECT COUNT(*) FROM __EFMigrationsHistory WHERE MigrationId IN ({placeholders})";
            for (int i = 0; i < LegacyMigrationIds.Length; i++)
            {
                var p = countCmd.CreateParameter();
                p.ParameterName = $"@p{i}";
                p.Value = LegacyMigrationIds[i];
                countCmd.Parameters.Add(p);
            }
            var legacyCount = (long)(countCmd.ExecuteScalar() ?? 0L);

            if (legacyCount == 0)
            {
                LogMigrationRemapSkipped(logger);
                return;
            }

            LogMigrationRemap(logger, (int)legacyCount);

            // Wrap the remap in a transaction for atomicity.
            using var tx = connection.BeginTransaction();
            try
            {
                // Remove all legacy entries.
                using var deleteCmd = connection.CreateCommand();
                deleteCmd.Transaction = tx;
                deleteCmd.CommandText = $"DELETE FROM __EFMigrationsHistory WHERE MigrationId IN ({placeholders})";
                for (int i = 0; i < LegacyMigrationIds.Length; i++)
                {
                    var p = deleteCmd.CreateParameter();
                    p.ParameterName = $"@p{i}";
                    p.Value = LegacyMigrationIds[i];
                    deleteCmd.Parameters.Add(p);
                }
                deleteCmd.ExecuteNonQuery();

                // Insert the consolidated migration ID if it isn't there yet.
                using var insertCmd = connection.CreateCommand();
                insertCmd.Transaction = tx;
                insertCmd.CommandText =
                    "INSERT OR IGNORE INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES (@id, @ver)";
                var idParam = insertCmd.CreateParameter();
                idParam.ParameterName = "@id";
                idParam.Value = ConsolidatedMigrationId;
                insertCmd.Parameters.Add(idParam);
                var verParam = insertCmd.CreateParameter();
                verParam.ParameterName = "@ver";
                verParam.Value = "10.0.0";
                insertCmd.Parameters.Add(verParam);
                insertCmd.ExecuteNonQuery();

                tx.Commit();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
        catch (Exception ex)
        {
            // Non-fatal: if the remap fails, Migrate() will surface a clearer error.
            logger.LogWarning(ex, "Could not remap legacy migration history. Proceeding anyway.");
        }
    }

    public static string GetAppConnectionString(this IConfiguration configuration, IWebHostEnvironment env)
    {
        string? connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? Environment.GetEnvironmentVariable("CONNECTION_STRING");

        if (string.IsNullOrEmpty(connectionString))
        {
            string dbPath = env.IsDevelopment() ? "./openresto.db" : "/data/openresto.db";
            connectionString = $"Data Source={dbPath}";
        }

        return connectionString;
    }

    public static IServiceCollection AddDatabaseSetup(this IServiceCollection services, string connectionString, IWebHostEnvironment env)
    {
        SqlitePragmaInterceptor pragmaInterceptor = new();

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlite(connectionString, sqliteOptions =>
            {
                sqliteOptions.CommandTimeout(30);
                sqliteOptions.ExecutionStrategy(d => new SqliteRetryingExecutionStrategy(d));
            });
            options.AddInterceptors(pragmaInterceptor);
            options.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.MultipleCollectionIncludeWarning));
            options.EnableSensitiveDataLogging(env.IsDevelopment());
            options.EnableDetailedErrors(env.IsDevelopment());
        });

        return services;
    }

    public static void InitializeDatabase(this WebApplication app, string connectionString, IConfiguration configuration)
    {
        using IServiceScope scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILogger logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        try
        {
            LogStartupDiagnostics(logger);
            LogConnectionString(logger, connectionString);
            LogCurrentUser(logger, Environment.UserName);

            // Ensure the DB directory exists (needed for Docker volume mounts)
            string dbFile = connectionString;
            if (connectionString.Contains(';'))
            {
                var parts = connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries);
                var ds = parts.FirstOrDefault(p => p.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase));
                if (ds != null)
                {
                    dbFile = ds.Substring("Data Source=".Length);
                }
            }
            else if (connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
            {
                dbFile = connectionString.Substring("Data Source=".Length);
            }

            if (!string.IsNullOrEmpty(dbFile))
            {
                string fullPath = Path.GetFullPath(dbFile);
                string? dir = Path.GetDirectoryName(fullPath);
                LogResolvedDbPath(logger, fullPath);
                if (dir != null)
                {
                    bool dirExists = Directory.Exists(dir);
                    LogDbDirectoryInfo(logger, dir, dirExists);
                    if (!dirExists)
                    {
                        try { Directory.CreateDirectory(dir); LogCreatedDbDirectory(logger, dir); }
                        catch (Exception ex) { LogFailedToCreateDbDirectory(logger, ex.Message); }
                    }
                    else
                    {
                        try
                        {
                            string testFile = Path.Combine(dir, ".write-test-" + Guid.NewGuid().ToString("N"));
                            File.WriteAllText(testFile, "test");
                            File.Delete(testFile);
                            LogDbDirectoryWritable(logger);
                        }
                        catch (Exception ex) { LogDbDirectoryNotWritable(logger, ex.Message); }
                    }
                }
            }

            // Squash migration history: if the DB still has the old incremental migration IDs
            // (from before the consolidation into InitialCreate), replace them all with the
            // single consolidated migration so EF doesn't try to CREATE already-existing tables.
            RemapLegacyMigrationHistory(db, logger);

            // Apply any pending EF migrations (creates DB on first run, adds columns on upgrade)
            int maxRetries = 10;
            int retryDelayMs = 2000;
            bool success = false;

            for (int i = 1; i <= maxRetries; i++)
            {
                try
                {
                    db.Database.Migrate();

                    DbSeeder.Seed(db);

                    if (!db.AdminCredentials.Any())
                    {
                        string? configEmail = configuration["Admin:Email"];
                        string email = !string.IsNullOrWhiteSpace(configEmail)
                            ? configEmail
                            : Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@openresto.com";

                        string? configPassword = configuration["Admin:Password"];
                        string? password = !string.IsNullOrWhiteSpace(configPassword)
                            ? configPassword
                            : Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

                        if (string.IsNullOrWhiteSpace(password))
                        {
                            throw new InvalidOperationException(
                                "Admin:Password must be configured before first use. Set it via ADMIN_PASSWORD env var.");
                        }
                        byte[] saltBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
                        string salt = Convert.ToBase64String(saltBytes);
                        byte[] hashBytes = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
                            password, saltBytes, 100_000,
                            System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
                        string hash = Convert.ToBase64String(hashBytes);
                        db.AdminCredentials.Add(new OpenRestoApi.Core.Domain.AdminCredential
                        {
                            Email = email,
                            PasswordHash = hash,
                            PasswordSalt = salt,
                        });
                        db.SaveChanges();
                    }

                    success = true;
                    break;
                }
                catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 8 || ex.SqliteErrorCode == 14 || ex.SqliteErrorCode == 5)
                {
                    LogDatabaseRetry(logger, ex.SqliteErrorCode, i, maxRetries, retryDelayMs);
                    if (i == maxRetries)
                    {
                        throw;
                    }

                    Thread.Sleep(retryDelayMs);
                }
            }

            if (!success)
            {
                throw new InvalidOperationException("Failed to initialize database after multiple retries.");
            }
        }
        catch (Exception ex)
        {
            LogFatalError(logger, ex);
            throw;
        }
    }
}
