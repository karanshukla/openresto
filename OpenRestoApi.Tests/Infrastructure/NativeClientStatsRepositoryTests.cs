using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The counter arithmetic, against real SQLite rather than the in-memory provider: the upsert
/// adds rather than replaces, days stay separate buckets, and the two reporting windows are
/// counted independently of each other.
/// </summary>
public class NativeClientStatsRepositoryTests : IDisposable
{
    private static readonly DateTime Now = new(2026, 8, 31, 12, 0, 0, DateTimeKind.Utc);

    private readonly SqliteConnection _connection;

    public NativeClientStatsRepositoryTests()
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
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static NativeClientObservation Observation(
        string platform, string version, DateTime day, int count = 1)
        => new(platform, version, DateOnly.FromDateTime(day), count, day);

    [Fact]
    public async Task UpsertAsync_AddsOntoAnExistingDay()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);

        await repository.UpsertAsync([Observation("ios", "1.9.0", Now, count: 3)]);
        await repository.UpsertAsync([Observation("ios", "1.9.0", Now.AddHours(1), count: 4)]);

        NativeClientStat row = Assert.Single(await db.NativeClientStats.ToListAsync());
        Assert.Equal(7, row.RequestCount);
        Assert.Equal(Now.AddHours(1), row.LastSeenUtc);
    }

    [Fact]
    public async Task UpsertAsync_KeepsDaysApart()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);

        await repository.UpsertAsync(
        [
            Observation("ios", "1.9.0", Now, count: 3),
            Observation("ios", "1.9.0", Now.AddDays(-1), count: 5),
        ]);

        Assert.Equal(2, await db.NativeClientStats.CountAsync());
    }

    [Fact]
    public async Task UpsertAsync_StopsTrackingNewVersionsAtTheCap()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);
        await repository.UpsertAsync(Enumerable.Range(0, NativeClientStatsRepository.MaxVersionsPerPlatform)
            .Select(i => Observation("android", $"0.0.{i}", Now)));

        await repository.UpsertAsync(
        [
            Observation("android", "9.9.9", Now),
            Observation("android", "0.0.1", Now.AddDays(1), count: 4),
            Observation("ios", "1.9.0", Now),
        ]);

        Assert.Equal(0, await db.NativeClientStats.CountAsync(s => s.AppVersion == "9.9.9"));
        Assert.Equal(2, await db.NativeClientStats.CountAsync(s => s.Platform == "android" && s.AppVersion == "0.0.1"));
        Assert.Equal(1, await db.NativeClientStats.CountAsync(s => s.Platform == "ios"));
    }

    [Fact]
    public async Task PruneOlderThanAsync_DropsOnlyBucketsBeforeTheCutoff()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);
        await repository.UpsertAsync(
        [
            Observation("ios", "1.9.0", Now.AddDays(-91)),
            Observation("ios", "1.9.0", Now.AddDays(-89)),
        ]);

        int removed = await repository.PruneOlderThanAsync(Now.AddDays(-90));

        Assert.Equal(1, removed);
        NativeClientStat kept = Assert.Single(await db.NativeClientStats.ToListAsync());
        Assert.Equal(DateOnly.FromDateTime(Now.AddDays(-89)), kept.Day);
    }

    [Fact]
    public async Task GetSummaryAsync_CountsEachWindowSeparately()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);
        await repository.UpsertAsync(
        [
            Observation("ios", "1.9.0", Now, count: 2),
            Observation("ios", "1.9.0", Now.AddDays(-6), count: 3),
            Observation("ios", "1.9.0", Now.AddDays(-20), count: 10),
            Observation("ios", "1.9.0", Now.AddDays(-40), count: 100),
        ]);

        NativeClientSummary summary = Assert.Single(await repository.GetSummaryAsync(Now));

        Assert.Equal(5, summary.RequestsLast7Days);
        Assert.Equal(15, summary.RequestsLast30Days);
        Assert.Equal(Now, summary.LastSeenUtc);
    }

    [Fact]
    public async Task GetSummaryAsync_OrdersByMostRecentlySeen()
    {
        using AppDbContext db = CreateContext();
        var repository = new NativeClientStatsRepository(db);
        await repository.UpsertAsync(
        [
            Observation("ios", "1.8.0", Now.AddDays(-5)),
            Observation("android", "1.9.0", Now),
            Observation("ios", "1.9.0", Now.AddDays(-1)),
        ]);

        IReadOnlyList<NativeClientSummary> summaries = await repository.GetSummaryAsync(Now);

        Assert.Equal(
            [("android", "1.9.0"), ("ios", "1.9.0"), ("ios", "1.8.0")],
            summaries.Select(s => (s.Platform, s.AppVersion)));
    }
}
