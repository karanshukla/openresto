using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace OpenRestoApi.Infrastructure.Persistence;

/// <summary>
/// Applies durability and concurrency PRAGMAs on every opened SQLite connection.
/// journal_mode is persisted in the file header, but busy_timeout / foreign_keys /
/// synchronous / temp_store are connection-scoped and reset on each new connection
/// from the pool — so they must be re-applied here, not just at startup.
/// </summary>
public sealed class SqlitePragmaInterceptor : DbConnectionInterceptor
{
    private const string PragmaSql = """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        PRAGMA busy_timeout=10000;
        PRAGMA foreign_keys=ON;
        PRAGMA temp_store=MEMORY;
        """;

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        ApplyPragmas(connection);
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await ApplyPragmasAsync(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    private static void ApplyPragmas(DbConnection connection)
    {
        try
        {
            using DbCommand cmd = connection.CreateCommand();
            cmd.CommandText = PragmaSql;
            cmd.ExecuteNonQuery();
        }
        catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 8 || ex.SqliteErrorCode == 14)
        {
            // Database is temporarily read-only (e.g. volume not yet fully mounted).
            // Skip PRAGMAs on this connection — they will be applied on subsequent
            // connections once the volume is writable.
        }
    }

    private static async Task ApplyPragmasAsync(DbConnection connection, CancellationToken ct)
    {
        try
        {
            await using DbCommand cmd = connection.CreateCommand();
            cmd.CommandText = PragmaSql;
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 8 || ex.SqliteErrorCode == 14)
        {
            // Database is temporarily read-only (e.g. volume not yet fully mounted).
            // Skip PRAGMAs on this connection — they will be applied on subsequent
            // connections once the volume is writable.
        }
    }
}
