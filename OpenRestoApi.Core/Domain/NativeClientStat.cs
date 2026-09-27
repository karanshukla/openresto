using System.ComponentModel.DataAnnotations;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Domain;

/// <summary>
/// One day's request count from one native build, and nothing else. There is deliberately no IP
/// address, device id, user agent or account on this row: the admin's native-app screen answers
/// "is anyone still on 1.8.0?", which needs a count per (platform, version, day) and cannot be
/// made to identify a guest no matter who reads the table.
/// </summary>
public class NativeClientStat
{
    public int Id { get; set; }

    /// <summary>One of <see cref="NativeClientIdentity.Platforms"/>.</summary>
    [StringLength(NativeClientIdentity.MaxPlatformLength)]
    public string Platform { get; set; } = string.Empty;

    /// <summary>A <see cref="NativeAppVersion"/> — strict <c>major.minor.patch</c>.</summary>
    [StringLength(NativeAppVersion.MaxLength)]
    public string AppVersion { get; set; } = string.Empty;

    /// <summary>The UTC day the requests were counted on; the bucket the unique index keys on.</summary>
    public DateOnly Day { get; set; }

    public int RequestCount { get; set; }

    public DateTime LastSeenUtc { get; set; }
}
