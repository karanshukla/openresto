using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Accumulate, prune and summarise. There is no read of an individual row and no delete of one:
/// the table is counters, and the only thing that removes rows is the retention pass.
/// </summary>
public interface INativeClientStatsRepository
{
    /// <summary>Adds each observation's count onto its (platform, version, day) row, creating it when absent.</summary>
    Task UpsertAsync(IEnumerable<NativeClientObservation> observations);

    /// <summary>Returns how many rows were dropped, for the flush pass to log.</summary>
    Task<int> PruneOlderThanAsync(DateTime cutoffUtc);

    /// <summary>Per (platform, version), most recently seen first.</summary>
    Task<IReadOnlyList<NativeClientSummary>> GetSummaryAsync(DateTime nowUtc);
}
