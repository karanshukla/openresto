using Microsoft.Data.Sqlite;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Infrastructure;

public class SqlitePragmaInterceptorTests
{
    [Fact]
    public void ApplyPragmas_ExecutesSuccessfully()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();

        // We can't easily test if pragmas were applied to a specific connection via the interceptor
        // because it's usually called by EF Core. But we can test the static method directly.
        
        // Use reflection to call the private static method ApplyPragmas
        var method = typeof(SqlitePragmaInterceptor).GetMethod("ApplyPragmas", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        method!.Invoke(null, [connection]);

        // Verify some pragmas
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode";
        var journalMode = cmd.ExecuteScalar()?.ToString();
        // In-memory DB always uses 'memory' journal mode regardless of WAL setting usually,
        // but let's check busy_timeout or foreign_keys
        
        cmd.CommandText = "PRAGMA busy_timeout";
        var busyTimeout = Convert.ToInt32(cmd.ExecuteScalar());
        Assert.Equal(10000, busyTimeout);

        cmd.CommandText = "PRAGMA foreign_keys";
        var foreignKeys = Convert.ToInt32(cmd.ExecuteScalar());
        Assert.Equal(1, foreignKeys);
    }

    [Fact]
    public async Task ApplyPragmasAsync_ExecutesSuccessfully()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var method = typeof(SqlitePragmaInterceptor).GetMethod("ApplyPragmasAsync", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        
        var task = (Task)method!.Invoke(null, [connection, CancellationToken.None])!;
        await task;

        using var cmd = connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys";
        var foreignKeys = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        Assert.Equal(1, foreignKeys);
    }
    
    [Fact]
    public void ConnectionOpened_AppliesPragmas()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var interceptor = new SqlitePragmaInterceptor();

        // The interceptor never dereferences eventData — it only forwards it to the
        // (no-op) base implementation — so a null event data is safe here.
        interceptor.ConnectionOpened(connection, null!);

        using var cmd = connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys";
        Assert.Equal(1, Convert.ToInt32(cmd.ExecuteScalar()));
    }

    [Fact]
    public async Task ConnectionOpenedAsync_AppliesPragmas()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var interceptor = new SqlitePragmaInterceptor();

        await interceptor.ConnectionOpenedAsync(connection, null!);

        using var cmd = connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys";
        Assert.Equal(1, Convert.ToInt32(await cmd.ExecuteScalarAsync()));
    }

    private static string CreateReadOnlyDbPath()
    {
        string path = Path.Combine(Path.GetTempPath(), $"openresto-pragma-{Guid.NewGuid()}.db");
        using (var init = new SqliteConnection($"Data Source={path}"))
        {
            init.Open();
            using SqliteCommand cmd = init.CreateCommand();
            cmd.CommandText = "CREATE TABLE t (id INTEGER)";
            cmd.ExecuteNonQuery();
        }
        return path;
    }

    [Fact]
    public void ApplyPragmas_SwallowsReadOnlyException()
    {
        // Opening a read-only connection against a real SQLite file makes the
        // write-mode PRAGMAs (journal_mode=WAL, etc.) fail with SQLITE_READONLY (8) —
        // the same failure mode the catch clause exists to swallow.
        string path = CreateReadOnlyDbPath();
        try
        {
            using var connection = new SqliteConnection($"Data Source={path};Mode=ReadOnly");
            connection.Open();
            var interceptor = new SqlitePragmaInterceptor();

            Exception? ex = Record.Exception(() => interceptor.ConnectionOpened(connection, null!));

            Assert.Null(ex);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task ApplyPragmasAsync_SwallowsReadOnlyException()
    {
        string path = CreateReadOnlyDbPath();
        try
        {
            using var connection = new SqliteConnection($"Data Source={path};Mode=ReadOnly");
            await connection.OpenAsync();
            var interceptor = new SqlitePragmaInterceptor();

            Exception? ex = await Record.ExceptionAsync(() => interceptor.ConnectionOpenedAsync(connection, null!));

            Assert.Null(ex);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
