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
    /// Adds onto the existing bucket rather than replacing it: a flush carries the counts since
    /// the previous flush, and there are many flushes to a day.
    /// <seealso>NativeClientStatsRepositoryTests.UpsertAsync_AddsOntoAnExistingDay</seealso>
    /// <seealso>NativeClientStatsRepositoryTests.UpsertAsync_KeepsDaysApart</seealso>
    /// </summary>
    public async Task UpsertAsync(IEnumerable<NativeClientObservation> observations)
    {
        foreach (NativeClientObservation observation in observations)
        {
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
