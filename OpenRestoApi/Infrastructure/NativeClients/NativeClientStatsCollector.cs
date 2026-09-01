using System.Collections.Concurrent;
using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.NativeClients;

/// <summary>
/// Counts native-client requests in memory so the pipeline never writes to SQLite per request —
/// the same reason <c>HoldService</c> is a singleton dictionary. A tally is an immutable value
/// swapped in by <see cref="ConcurrentDictionary{TKey,TValue}.AddOrUpdate(TKey, Func{TKey,TValue}, Func{TKey,TValue,TValue})"/>,
/// which retries its update factory under contention: mutating a shared counter object there
/// would double-apply the retry.
/// <para>
/// A restart between flushes loses at most the current minute of counts, which is why this
/// holds counters and nothing a report depends on being exact.
/// </para>
/// </summary>
/// <seealso>NativeClientStatsCollectorTests.Record_AccumulatesRequestsPerPlatformVersionAndDay</seealso>
/// <seealso>NativeClientStatsCollectorTests.Record_KeepsTheLatestSighting</seealso>
/// <seealso>NativeClientStatsCollectorTests.Drain_EmptiesTheCollector</seealso>
/// <seealso>NativeClientStatsCollectorTests.Record_CountsEveryRequestUnderConcurrency</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientStatsCollectorTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientStatsWorkerTests")]
[ExternalAccessAllowed]
internal sealed class NativeClientStatsCollector : INativeClientStatsCollector
{
    private sealed record Bucket(string Platform, string AppVersion, DateOnly Day);

    private sealed record Tally(int RequestCount, DateTime LastSeenUtc);

    private ConcurrentDictionary<Bucket, Tally> _tallies = new();

    public void Record(string platform, string appVersion, DateTime nowUtc)
    {
        var bucket = new Bucket(platform, appVersion, DateOnly.FromDateTime(nowUtc));
        _tallies.AddOrUpdate(
            bucket,
            _ => new Tally(1, nowUtc),
            (_, tally) => new Tally(
                tally.RequestCount + 1,
                nowUtc > tally.LastSeenUtc ? nowUtc : tally.LastSeenUtc));
    }

    public IReadOnlyList<NativeClientObservation> Drain()
    {
        ConcurrentDictionary<Bucket, Tally> drained = Interlocked.Exchange(ref _tallies, new ConcurrentDictionary<Bucket, Tally>());
        return [.. drained.Select(entry => new NativeClientObservation(
            entry.Key.Platform,
            entry.Key.AppVersion,
            entry.Key.Day,
            entry.Value.RequestCount,
            entry.Value.LastSeenUtc))];
    }
}
