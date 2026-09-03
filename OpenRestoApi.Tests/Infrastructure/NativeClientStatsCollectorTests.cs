using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Infrastructure.NativeClients;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The in-memory half of the telemetry: that counts land in the right bucket, that a drain
/// really empties it (a second flush must not re-write the same counts), and that nothing is
/// lost when requests arrive in parallel — which they always do.
/// </summary>
public class NativeClientStatsCollectorTests
{
    private static readonly DateTime Monday = new(2026, 8, 31, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Record_AccumulatesRequestsPerPlatformVersionAndDay()
    {
        var collector = new NativeClientStatsCollector();

        collector.Record("ios", "1.9.0", Monday);
        collector.Record("ios", "1.9.0", Monday.AddHours(1));
        collector.Record("android", "1.9.0", Monday);
        collector.Record("ios", "1.8.0", Monday);
        collector.Record("ios", "1.9.0", Monday.AddDays(1));

        IReadOnlyList<NativeClientObservation> drained = collector.Drain();

        Assert.Equal(4, drained.Count);
        Assert.Equal(2, Find(drained, "ios", "1.9.0", DateOnly.FromDateTime(Monday)).RequestCount);
        Assert.Equal(1, Find(drained, "android", "1.9.0", DateOnly.FromDateTime(Monday)).RequestCount);
        Assert.Equal(1, Find(drained, "ios", "1.8.0", DateOnly.FromDateTime(Monday)).RequestCount);
        Assert.Equal(1, Find(drained, "ios", "1.9.0", DateOnly.FromDateTime(Monday.AddDays(1))).RequestCount);
    }

    [Fact]
    public void Record_KeepsTheLatestSighting()
    {
        var collector = new NativeClientStatsCollector();

        collector.Record("ios", "1.9.0", Monday.AddHours(3));
        collector.Record("ios", "1.9.0", Monday);

        Assert.Equal(Monday.AddHours(3), Assert.Single(collector.Drain()).LastSeenUtc);
    }

    [Fact]
    public void Drain_EmptiesTheCollector()
    {
        var collector = new NativeClientStatsCollector();
        collector.Record("ios", "1.9.0", Monday);

        Assert.Single(collector.Drain());
        Assert.Empty(collector.Drain());
    }

    [Fact]
    public void Record_CountsEveryRequestUnderConcurrency()
    {
        var collector = new NativeClientStatsCollector();

        Parallel.For(0, 1000, _ => collector.Record("android", "1.9.0", Monday));

        Assert.Equal(1000, Assert.Single(collector.Drain()).RequestCount);
    }

    [Fact]
    public void Record_StopsOpeningBucketsAtTheCap()
    {
        var collector = new NativeClientStatsCollector();
        collector.Record("ios", "1.9.0", Monday);

        for (int i = 0; i < NativeClientStatsCollector.MaxBuckets + 50; i++)
        {
            collector.Record("android", $"0.0.{i}", Monday);
        }
        collector.Record("ios", "1.9.0", Monday.AddHours(1));

        IReadOnlyList<NativeClientObservation> drained = collector.Drain();

        Assert.Equal(NativeClientStatsCollector.MaxBuckets, drained.Count);
        Assert.Equal(2, Find(drained, "ios", "1.9.0", DateOnly.FromDateTime(Monday)).RequestCount);
    }

    private static NativeClientObservation Find(
        IReadOnlyList<NativeClientObservation> drained, string platform, string version, DateOnly day)
        => Assert.Single(drained, o => o.Platform == platform && o.AppVersion == version && o.Day == day);
}
