using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// The in-memory buffer between the request pipeline and the database. Every request from a
/// native client goes through <see cref="Record"/>, so it must not touch storage; the worker
/// that flushes it calls <see cref="Drain"/> once a minute.
/// </summary>
public interface INativeClientStatsCollector
{
    void Record(string platform, string appVersion, DateTime nowUtc);

    /// <summary>Takes everything accumulated so far and leaves the collector empty.</summary>
    IReadOnlyList<NativeClientObservation> Drain();
}
