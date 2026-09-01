using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.NativeClients;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The scheduling around the flush: that counts reach the database at all, that the retention
/// cutoff is applied on the way through, that an idle instance never opens a connection, that
/// shutdown does not throw away the minute since the last tick, and that a failed pass leaves
/// the worker running. The counter arithmetic itself is
/// <c>NativeClientStatsRepositoryTests</c>'.
/// </summary>
public class NativeClientStatsWorkerTests : IDisposable
{
    private static readonly TimeSpan Rapidly = TimeSpan.FromMilliseconds(20);
    private static readonly TimeSpan Never = TimeSpan.FromHours(1);
    private static readonly DateTime Now = new(2026, 8, 31, 12, 0, 0, DateTimeKind.Utc);

    private readonly SqliteConnection _connection;

    public NativeClientStatsWorkerTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        using AppDbContext db = CreateContext();
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => Now;
    }

    /// <summary>
    /// Counts completed passes so a test can wait on the worker without querying the database
    /// from its own thread — the worker and the test would otherwise be two threads on one
    /// SQLite connection, which fails for reasons that have nothing to do with the worker.
    /// </summary>
    private sealed class CountingRepository(INativeClientStatsRepository inner) : INativeClientStatsRepository
    {
        private int _upserts;
        private int _prunes;

        public int Upserts => Volatile.Read(ref _upserts);

        public int Prunes => Volatile.Read(ref _prunes);

        public async Task UpsertAsync(IEnumerable<NativeClientObservation> observations)
        {
            await inner.UpsertAsync(observations);
            Interlocked.Increment(ref _upserts);
        }

        public async Task<int> PruneOlderThanAsync(DateTime cutoffUtc)
        {
            int removed = await inner.PruneOlderThanAsync(cutoffUtc);
            Interlocked.Increment(ref _prunes);
            return removed;
        }

        public Task<IReadOnlyList<NativeClientSummary>> GetSummaryAsync(DateTime nowUtc)
            => inner.GetSummaryAsync(nowUtc);
    }

    /// <summary>A collector that always has one bucket to flush, so every tick has work to do.</summary>
    private sealed class AlwaysBusyCollector : INativeClientStatsCollector
    {
        public void Record(string platform, string appVersion, DateTime nowUtc) { }

        public IReadOnlyList<NativeClientObservation> Drain()
            => [new("ios", "1.9.0", DateOnly.FromDateTime(Now), 1, Now)];
    }

    private AppDbContext CreateContext()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        return new AppDbContext(options);
    }

    private static Mock<IServiceScopeFactory> ScopeFactoryFor(INativeClientStatsRepository repository)
    {
        var provider = new Mock<IServiceProvider>();
        provider.Setup(p => p.GetService(typeof(INativeClientStatsRepository))).Returns(repository);

        var scope = new Mock<IServiceScope>();
        scope.Setup(s => s.ServiceProvider).Returns(provider.Object);

        var factory = new Mock<IServiceScopeFactory>();
        factory.Setup(f => f.CreateScope()).Returns(scope.Object);
        return factory;
    }

    private static NativeClientStatsWorker CreateWorker(
        INativeClientStatsCollector collector, INativeClientStatsRepository repository, TimeSpan interval)
        => new(
            collector,
            ScopeFactoryFor(repository).Object,
            new FixedClock(),
            NullLogger<NativeClientStatsWorker>.Instance,
            interval);

    private static async Task RunUntilAsync(NativeClientStatsWorker worker, Func<bool> done)
    {
        await worker.StartAsync(CancellationToken.None);
        try
        {
            for (int attempt = 0; attempt < 100 && !done(); attempt++)
            {
                await Task.Delay(20);
            }
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task FlushesCollectedCountsIntoTheDatabase()
    {
        using AppDbContext db = CreateContext();
        var collector = new NativeClientStatsCollector();
        collector.Record("android", "1.9.0", Now);
        collector.Record("android", "1.9.0", Now);
        var repository = new CountingRepository(new NativeClientStatsRepository(db));
        NativeClientStatsWorker worker = CreateWorker(collector, repository, Rapidly);

        await RunUntilAsync(worker, () => repository.Upserts > 0);

        using AppDbContext reader = CreateContext();
        NativeClientStat row = Assert.Single(await reader.NativeClientStats.ToListAsync());
        Assert.Equal("android", row.Platform);
        Assert.Equal(2, row.RequestCount);
    }

    [Fact]
    public async Task PrunesBucketsPastTheRetentionWindow()
    {
        using AppDbContext seed = CreateContext();
        seed.NativeClientStats.Add(new NativeClientStat
        {
            Platform = "ios",
            AppVersion = "1.0.0",
            Day = DateOnly.FromDateTime(Now.AddDays(-(NativeClientStatsWorker.RetentionDays + 1))),
            RequestCount = 5,
            LastSeenUtc = Now.AddDays(-(NativeClientStatsWorker.RetentionDays + 1)),
        });
        await seed.SaveChangesAsync();

        using AppDbContext db = CreateContext();
        var collector = new NativeClientStatsCollector();
        collector.Record("ios", "1.9.0", Now);
        var repository = new CountingRepository(new NativeClientStatsRepository(db));
        NativeClientStatsWorker worker = CreateWorker(collector, repository, Rapidly);

        await RunUntilAsync(worker, () => repository.Prunes > 0);

        using AppDbContext reader = CreateContext();
        NativeClientStat kept = Assert.Single(await reader.NativeClientStats.ToListAsync());
        Assert.Equal("1.9.0", kept.AppVersion);
    }

    [Fact]
    public async Task AnIdlePassTouchesNoDatabase()
    {
        var repository = new Mock<INativeClientStatsRepository>(MockBehavior.Strict);
        NativeClientStatsWorker worker = CreateWorker(new NativeClientStatsCollector(), repository.Object, Rapidly);

        await worker.StartAsync(CancellationToken.None);
        await Task.Delay(120);
        await worker.StopAsync(CancellationToken.None);

        repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task StopAsync_FlushesWhatTheLastTickDidNot()
    {
        using AppDbContext db = CreateContext();
        var collector = new NativeClientStatsCollector();
        collector.Record("ios", "1.9.0", Now);
        NativeClientStatsWorker worker = CreateWorker(collector, new NativeClientStatsRepository(db), Never);

        await worker.StartAsync(CancellationToken.None);
        using (AppDbContext beforeShutdown = CreateContext())
        {
            Assert.Empty(await beforeShutdown.NativeClientStats.ToListAsync());
        }

        await worker.StopAsync(CancellationToken.None);

        using AppDbContext reader = CreateContext();
        Assert.Single(await reader.NativeClientStats.ToListAsync());
    }

    [Fact]
    public async Task SurvivesAFailedPass_AndTriesAgainOnTheNextTick()
    {
        int attempts = 0;
        var repository = new Mock<INativeClientStatsRepository>();
        repository
            .Setup(r => r.UpsertAsync(It.IsAny<IEnumerable<NativeClientObservation>>()))
            .Returns(() => ++attempts == 1
                ? Task.FromException(new InvalidOperationException("database is locked"))
                : Task.CompletedTask);

        NativeClientStatsWorker worker = CreateWorker(new AlwaysBusyCollector(), repository.Object, Rapidly);

        await RunUntilAsync(worker, () => attempts >= 3);

        Assert.True(attempts >= 3, $"Worker stopped flushing after {attempts} attempt(s).");
    }
}
