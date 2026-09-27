namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// One accumulated bucket handed from the in-memory collector to the repository: a
/// (platform, version, day) key and what was counted against it since the last flush.
/// </summary>
public sealed record NativeClientObservation(
    string Platform,
    string AppVersion,
    DateOnly Day,
    int RequestCount,
    DateTime LastSeenUtc);

/// <summary>Aggregate use of one native build, as the admin screen lists it.</summary>
public sealed record NativeClientSummary(
    string Platform,
    string AppVersion,
    DateTime LastSeenUtc,
    int RequestsLast7Days,
    int RequestsLast30Days);

/// <summary>One row of the readiness checklist. See <c>NativeAppChecks</c> for the ids and statuses.</summary>
public class NativeAppCheckDto
{
    public string Id { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    /// <summary>A short factual sentence the admin screen shows verbatim under the check.</summary>
    public string Detail { get; set; } = string.Empty;

    /// <summary>The address the check reports on, when there is one to open.</summary>
    public string? Url { get; set; }
}

public class NativeAppStatusResponse
{
    /// <summary>The public address the checks ran against, or null when none is configured.</summary>
    public string? ServerUrl { get; set; }

    public List<NativeAppCheckDto> Checks { get; set; } = [];

    public string? MinimumAppVersion { get; set; }

    public List<NativeClientSummary> Clients { get; set; } = [];
}
