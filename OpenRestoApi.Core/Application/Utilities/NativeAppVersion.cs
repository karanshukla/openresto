using System.Text.RegularExpressions;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The one definition of a native app version string: strict <c>major.minor.patch</c>, no
/// pre-release suffix and no <c>v</c> prefix. Shared by the version a client reports in its
/// <see cref="NativeClientIdentity.HeaderName"/> header and the minimum version an admin
/// configures, so the two can never drift into accepting different shapes.
/// </summary>
/// <seealso>NativeAppVersionTests.IsValid_AcceptsMajorMinorPatch</seealso>
/// <seealso>NativeAppVersionTests.IsValid_RejectsAnythingElse</seealso>
public static partial class NativeAppVersion
{
    /// <summary>Matches <c>BrandSettings.MinimumAppVersion</c>'s column width.</summary>
    public const int MaxLength = 32;

    [GeneratedRegex(@"^\d+\.\d+\.\d+$")]
    private static partial Regex Pattern();

    public static bool IsValid(string? value)
        => value is not null && value.Length <= MaxLength && Pattern().IsMatch(value);
}
