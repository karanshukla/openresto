using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Extensions;

public static class DatabaseExtensions
{
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
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlite(connectionString, sqliteOptions =>
            {
                sqliteOptions.CommandTimeout(30);
            });
            options.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.MultipleCollectionIncludeWarning));
            options.EnableSensitiveDataLogging(env.IsDevelopment());
            options.EnableDetailedErrors(env.IsDevelopment());
        });

        return services;
    }

    public static void InitializeDatabase(this WebApplication app, string connectionString, IConfiguration configuration)
    {
        // Ensure DB is created for first run - with retry loop for volume availability
        using IServiceScope scope = app.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        ILogger logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

        try
        {
            logger.LogInformation("Startup Diagnostics:");
            logger.LogInformation("  - Connection String: {ConnectionString}", connectionString);
            logger.LogInformation("  - Current User: {User}", Environment.UserName);

            // Parse Data Source path correctly
            string dbFile = connectionString;
            if (connectionString.Contains(';'))
            {
                var parts = connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries);
                var dataSourcePart = parts.FirstOrDefault(p => p.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase));
                if (dataSourcePart != null)
                {
                    dbFile = dataSourcePart.Substring("Data Source=".Length);
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
                logger.LogInformation("  - Resolved DB Path: {Path}", fullPath);
                if (dir != null)
                {
                    bool dirExists = Directory.Exists(dir);
                    logger.LogInformation("  - DB Directory: {Dir} (Exists: {Exists})", dir, dirExists);
                    if (dirExists)
                    {
                        try
                        {
                            string testFile = Path.Combine(dir, ".write-test-" + Guid.NewGuid().ToString("N"));
                            File.WriteAllText(testFile, "test");
                            File.Delete(testFile);
                            logger.LogInformation("  - DB Directory is writable.");
                        }
                        catch (Exception ex)
                        {
                            logger.LogError("  - DB Directory IS NOT WRITABLE: {Message}", ex.Message);
                        }
                    }
                    else
                    {
                        try
                        {
                            Directory.CreateDirectory(dir);
                            logger.LogInformation("  - Created DB Directory: {Dir}", dir);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError("  - Failed to create DB Directory: {Message}", ex.Message);
                        }
                    }
                }
            }

            int maxRetries = 10;
            int retryDelayMs = 2000;
            bool success = false;

            for (int i = 1; i <= maxRetries; i++)
            {
                try
                {
                    db.Database.EnsureCreated();

                    db.Database.ExecuteSqlRaw("PRAGMA journal_mode=DELETE;");
                    db.Database.ExecuteSqlRaw("PRAGMA busy_timeout=5000;");

                    db.Database.ExecuteSqlRaw("""
                        CREATE TABLE IF NOT EXISTS "AdminCredentials" (
                            "Id"               INTEGER NOT NULL CONSTRAINT "PK_AdminCredentials" PRIMARY KEY AUTOINCREMENT,
                            "Email"            TEXT    NOT NULL,
                            "PasswordHash"     TEXT    NOT NULL,
                            "PasswordSalt"     TEXT    NOT NULL,
                            "PvqQuestion"      TEXT,
                            "PvqAnswerHash"    TEXT,
                            "PvqAnswerSalt"    TEXT,
                            "ResetToken"       TEXT,
                            "ResetTokenExpiry" TEXT
                        )
                        """);

                    bool ColumnExists(string table, string column)
                    {
                        using DbCommand cmd = db.Database.GetDbConnection().CreateCommand();
                        cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'";
                        db.Database.OpenConnection();
                        int result = Convert.ToInt32(cmd.ExecuteScalar(), System.Globalization.CultureInfo.InvariantCulture);
                        return result > 0;
                    }

                    void AddColumnIfMissing(string table, string column, string definition)
                    {
                        if (!ColumnExists(table, column))
                        {
#pragma warning disable EF1002
                            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition}");
#pragma warning restore EF1002
                        }
                    }

                    AddColumnIfMissing("Bookings", "BookingRef", "TEXT NOT NULL DEFAULT ''");
                    AddColumnIfMissing("Bookings", "SpecialRequests", "TEXT");
                    AddColumnIfMissing("Bookings", "EndTime", "TEXT");
                    AddColumnIfMissing("Bookings", "IsCancelled", "INTEGER NOT NULL DEFAULT 0");
                    AddColumnIfMissing("Bookings", "CancelledAt", "TEXT");

                    AddColumnIfMissing("Restaurants", "OpenTime", "TEXT NOT NULL DEFAULT '09:00'");
                    AddColumnIfMissing("Restaurants", "CloseTime", "TEXT NOT NULL DEFAULT '22:00'");
                    AddColumnIfMissing("Restaurants", "OpenDays", "TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7'");
                    AddColumnIfMissing("Restaurants", "Timezone", "TEXT NOT NULL DEFAULT 'UTC'");

                    db.Database.ExecuteSqlRaw(@"
                        CREATE TABLE IF NOT EXISTS ""EmailSettings"" (
                            ""Id"" INTEGER PRIMARY KEY AUTOINCREMENT,
                            ""Host"" TEXT NOT NULL DEFAULT '',
                            ""Port"" INTEGER NOT NULL DEFAULT 587,
                            ""Username"" TEXT NOT NULL DEFAULT '',
                            ""EncryptedPassword"" TEXT NOT NULL DEFAULT '',
                            ""EnableSsl"" INTEGER NOT NULL DEFAULT 1,
                            ""FromName"" TEXT,
                            ""FromEmail"" TEXT
                        )");

                    db.Database.ExecuteSqlRaw(@"
                        CREATE TABLE IF NOT EXISTS ""BrandSettings"" (
                            ""Id"" INTEGER PRIMARY KEY AUTOINCREMENT,
                            ""AppName"" TEXT NOT NULL DEFAULT 'Open Resto',
                            ""PrimaryColor"" TEXT NOT NULL DEFAULT '#0a7ea4',
                            ""AccentColor"" TEXT,
                            ""LogoBase64"" TEXT
                        )");

                    DbSeeder.Seed(db);

                    if (!db.AdminCredentials.Any())
                    {
                        string email = configuration["Admin:Email"] ?? "example@example.com";
                        string password = configuration["Admin:Password"] ?? "password";
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
                    logger.LogWarning("Database volume not yet writable/available (SQLite Error {ErrorCode}). Retry {RetryCount}/{MaxRetries} in {Delay}ms...", ex.SqliteErrorCode, i, maxRetries, retryDelayMs);
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
            logger.LogCritical(ex, "FATAL ERROR during database initialization. The application cannot start.");
            // Do not rethrow here if you want the app to stay alive but "broken", 
            // but usually it's better to let it fail so Docker restarts it.
            throw;
        }
    }
}
