using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Storage;

namespace OpenRestoApi.Infrastructure.Persistence;

/// <summary>
/// Retries EF Core operations on transient SQLite locking errors (SQLITE_BUSY / SQLITE_LOCKED).
/// busy_timeout handles the first wait internally; this strategy handles the rare case where
/// a lock is still held when busy_timeout expires.
/// </summary>
public sealed class SqliteRetryingExecutionStrategy(ExecutionStrategyDependencies dependencies)
    : ExecutionStrategy(dependencies, maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(2))
{
    protected override bool ShouldRetryOn(Exception exception) =>
        exception is SqliteException { SqliteErrorCode: 5 or 6 };

    // Use short fixed delays rather than the base class's slow exponential backoff.
    protected override TimeSpan? GetNextDelay(Exception lastException) =>
        ExceptionsEncountered.Count switch
        {
            1 => TimeSpan.FromMilliseconds(200),
            2 => TimeSpan.FromMilliseconds(500),
            3 => TimeSpan.FromSeconds(1),
            _ => null,
        };
}
