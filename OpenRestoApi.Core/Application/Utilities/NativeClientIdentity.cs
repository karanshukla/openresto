namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Reads the <c>X-OpenResto-Client: &lt;platform&gt;/&lt;version&gt;</c> header the native guest
/// app sends on every request (e.g. <c>android/1.9.0</c>); the web build sends nothing. Purely a
/// parser: a header that isn't one of the two platforms carrying a
/// <see cref="NativeAppVersion"/> is ignored, never rejected and never logged. The header is
/// caller-supplied and unauthenticated, so a garbage value is noise rather than an event, and
/// anything that recorded it would be recording an attacker's free-text into the database.
/// </summary>
/// <seealso>NativeClientIdentityTests.TryParse_AcceptsIosAndAndroidWithASemanticVersion</seealso>
/// <seealso>NativeClientIdentityTests.TryParse_RejectsAnUnknownPlatform</seealso>
/// <seealso>NativeClientIdentityTests.TryParse_RejectsAVersionThatIsNotMajorMinorPatch</seealso>
/// <seealso>NativeClientIdentityTests.TryParse_RejectsMalformedHeaders</seealso>
public static class NativeClientIdentity
{
    public const string HeaderName = "X-OpenResto-Client";

    /// <summary>Matches <c>NativeClientStat.Platform</c>'s column width.</summary>
    public const int MaxPlatformLength = 16;

    /// <summary>The platforms a native build is published for; lowercase, exactly as sent.</summary>
    public static readonly IReadOnlySet<string> Platforms =
        new HashSet<string>(StringComparer.Ordinal) { "ios", "android" };

    public static bool TryParse(string? header, out string platform, out string version)
    {
        platform = string.Empty;
        version = string.Empty;

        if (string.IsNullOrEmpty(header)) return false;

        int separator = header.IndexOf('/', StringComparison.Ordinal);
        if (separator <= 0 || separator == header.Length - 1) return false;

        string candidatePlatform = header[..separator];
        string candidateVersion = header[(separator + 1)..];

        if (!Platforms.Contains(candidatePlatform) || !NativeAppVersion.IsValid(candidateVersion))
        {
            return false;
        }

        platform = candidatePlatform;
        version = candidateVersion;
        return true;
    }
}
