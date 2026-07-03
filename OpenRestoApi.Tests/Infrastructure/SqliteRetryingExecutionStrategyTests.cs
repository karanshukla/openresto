using System.Reflection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Infrastructure;

public class SqliteRetryingExecutionStrategyTests
{
    private static SqliteRetryingExecutionStrategy CreateStrategy(out DbContext context)
    {
        DbContextOptions<DbContext> options = new DbContextOptionsBuilder<DbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        context = new DbContext(options);
        IServiceProvider services = ((IInfrastructure<IServiceProvider>)context).Instance;
        ExecutionStrategyDependencies deps = services.GetRequiredService<ExecutionStrategyDependencies>();
        return new SqliteRetryingExecutionStrategy(deps);
    }

    private static bool InvokeShouldRetryOn(SqliteRetryingExecutionStrategy strategy, Exception ex)
    {
        MethodInfo method = typeof(SqliteRetryingExecutionStrategy).GetMethod(
            "ShouldRetryOn", BindingFlags.Instance | BindingFlags.NonPublic)!;
        return (bool)method.Invoke(strategy, [ex])!;
    }

    private static TimeSpan? InvokeGetNextDelay(SqliteRetryingExecutionStrategy strategy, Exception ex)
    {
        MethodInfo method = typeof(SqliteRetryingExecutionStrategy).GetMethod(
            "GetNextDelay", BindingFlags.Instance | BindingFlags.NonPublic)!;
        return (TimeSpan?)method.Invoke(strategy, [ex]);
    }

    [Theory]
    [InlineData(5)] // SQLITE_BUSY
    [InlineData(6)] // SQLITE_LOCKED
    public void ShouldRetryOn_ReturnsTrue_ForBusyOrLockedSqliteErrors(int errorCode)
    {
        SqliteRetryingExecutionStrategy strategy = CreateStrategy(out DbContext context);
        using (context)
        {
            bool result = InvokeShouldRetryOn(strategy, new SqliteException("locked", errorCode));
            Assert.True(result);
        }
    }

    [Fact]
    public void ShouldRetryOn_ReturnsFalse_ForOtherSqliteErrors()
    {
        SqliteRetryingExecutionStrategy strategy = CreateStrategy(out DbContext context);
        using (context)
        {
            bool result = InvokeShouldRetryOn(strategy, new SqliteException("constraint failed", 19));
            Assert.False(result);
        }
    }

    [Fact]
    public void ShouldRetryOn_ReturnsFalse_ForNonSqliteExceptions()
    {
        SqliteRetryingExecutionStrategy strategy = CreateStrategy(out DbContext context);
        using (context)
        {
            bool result = InvokeShouldRetryOn(strategy, new InvalidOperationException("not sqlite"));
            Assert.False(result);
        }
    }

    [Theory]
    [InlineData(1, 200)]
    [InlineData(2, 500)]
    [InlineData(3, 1000)]
    public void GetNextDelay_ReturnsFixedDelay_ForFirstThreeAttempts(int attemptCount, int expectedMs)
    {
        SqliteRetryingExecutionStrategy strategy = CreateStrategy(out DbContext context);
        using (context)
        {
            PropertyInfo prop = typeof(ExecutionStrategy).GetProperty(
                "ExceptionsEncountered", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!;
            var list = (List<Exception>)prop.GetValue(strategy)!;
            for (int i = 0; i < attemptCount; i++)
                list.Add(new SqliteException("locked", 5));

            TimeSpan? delay = InvokeGetNextDelay(strategy, new SqliteException("locked", 5));

            Assert.Equal(TimeSpan.FromMilliseconds(expectedMs), delay);
        }
    }

    [Fact]
    public void GetNextDelay_ReturnsNull_AfterThreeAttempts()
    {
        SqliteRetryingExecutionStrategy strategy = CreateStrategy(out DbContext context);
        using (context)
        {
            PropertyInfo prop = typeof(ExecutionStrategy).GetProperty(
                "ExceptionsEncountered", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)!;
            var list = (List<Exception>)prop.GetValue(strategy)!;
            for (int i = 0; i < 4; i++)
                list.Add(new SqliteException("locked", 5));

            TimeSpan? delay = InvokeGetNextDelay(strategy, new SqliteException("locked", 5));

            Assert.Null(delay);
        }
    }
}
