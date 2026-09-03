using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientStatsRepositoryTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientStatsWorkerTests")]
[ExternalAccessAllowed]
internal class NativeClientStatsRepository(AppDbContext db) : INativeClientStatsRepository
{
    private readonly AppDbContext _db = db;

    /// <summary>
    /// How many distinct app versions per platform the table will track. The collector caps a
    /// minute's worth; this caps what accumulates across minutes, since a version the table
    /// has never seen is a row per day until it ages out. A version already tracked keeps
    /// counting past the cap, so the builds actually in use are never the ones dropped.
    /// </summary>
    public const int MaxVersionsPerPlatform = 64;

    /// <summary>
    /// Adds onto the existing bucket rather than replacing it: a flush carries the counts since
    /// the previous flush, and there are many flushes to a day.
    /// <seealso>NativeClientStatsRepositoryTests.UpsertAsync_AddsOntoAnExistingDay</seealso>
    /// <seealso>NativeClientStatsRepositoryTests.UpsertAsync_KeepsDaysApart</seealso>
    /// <seealso>NativeClientStatsRepositoryTests.UpsertAsync_StopsTrackingNewVersionsAtTheCap</seealso>
    /// </summary>
    public async Task UpsertAsync(IEnumerable<NativeClientObservation> observations)
    {
        var tracked = (await _db.NativeClientStats
                .Select(s => new { s.Platform, s.AppVersion })
                .Distinct()
                .ToListAsync())
            .GroupBy(v => v.Platform)
            .ToDictionary(g => g.Key, g => g.Select(v => v.AppVersion).ToHashSet(StringComparer.Ordinal));

        foreach (NativeClientObservation observation in observations)
        {
            HashSet<string> versions = tracked.TryGetValue(observation.Platform, out HashSet<string>? known)
                ? known
                : tracked[observation.Platform] = new HashSet<string>(StringComparer.Ordinal);
            if (!versions.Contains(observation.AppVersion))
            {
                if (versions.Count >= MaxVersionsPerPlatform) continue;
                versions.Add(observation.AppVersion);
            }

            NativeClientStat? existing = await _db.NativeClientStats.FirstOrDefaultAsync(s =>
                s.Platform == observation.Platform
                && s.AppVersion == observation.AppVersion
                && s.Day == observation.Day);

            if (existing == null)
            {
                _db.NativeClientStats.Add(new NativeClientStat
                {
                    Platform = observation.Platform,
                    AppVersion = observation.AppVersion,
                    Day = observation.Day,
                    RequestCount = observation.RequestCount,
                    LastSeenUtc = observation.LastSeenUtc,
                });
            }
            else
            {
                existing.RequestCount += observation.RequestCount;
                if (observation.LastSeenUtc > existing.LastSeenUtc)
                {
                    existing.LastSeenUtc = observation.LastSeenUtc;
                }
            }
        }

        await _db.SaveChangesAsync();
    }

    public async Task<int> PruneOlderThanAsync(DateTime cutoffUtc)
    {
        DateOnly cutoff = DateOnly.FromDateTime(cutoffUtc);
        return await _db.NativeClientStats.Where(s => s.Day < cutoff).ExecuteDeleteAsync();
    }

    /// <summary>
    /// <seealso>NativeClientStatsRepositoryTests.GetSummaryAsync_CountsEachWindowSeparately</seealso>
    /// <seealso>NativeClientStatsRepositoryTests.GetSummaryAsync_OrdersByMostRecentlySeen</seealso>
    /// </summary>
    public async Task<IReadOnlyList<NativeClientSummary>> GetSummaryAsync(DateTime nowUtc)
    {
        DateOnly last7 = DateOnly.FromDateTime(nowUtc.AddDays(-7));
        DateOnly last30 = DateOnly.FromDateTime(nowUtc.AddDays(-30));

        var grouped = await _db.NativeClientStats
            .AsNoTracking()
            .GroupBy(s => new { s.Platform, s.AppVersion })
            .Select(g => new
            {
                g.Key.Platform,
                g.Key.AppVersion,
                LastSeenUtc = g.Max(s => s.LastSeenUtc),
                RequestsLast7Days = g.Sum(s => s.Day >= last7 ? s.RequestCount : 0),
                RequestsLast30Days = g.Sum(s => s.Day >= last30 ? s.RequestCount : 0),
            })
            .ToListAsync();

        return [.. grouped
            .OrderByDescending(g => g.LastSeenUtc)
            .Select(g => new NativeClientSummary(
                g.Platform, g.AppVersion, g.LastSeenUtc, g.RequestsLast7Days, g.RequestsLast30Days))];
    }
}
