namespace OpenRestoApi.Core.Domain;

/// <summary>
/// The sites allowed to frame the booking widget. Stored on <see cref="BrandSettings.EmbedOrigins"/>
/// as canonical origins separated by single spaces, which is already the shape a CSP
/// <c>frame-ancestors</c> source list takes.
/// </summary>
public static class EmbedOrigins
{
    public const int MaxCount = 20;

    /// <summary>The <c>frame-ancestors</c> value that refuses every embedder.</summary>
    public const string NoneAllowed = "'none'";

    private static readonly HashSet<string> _schemes = new(StringComparer.OrdinalIgnoreCase) { "http", "https" };

    /// <summary>
    /// Reduces <paramref name="value"/> to <c>scheme://host[:port]</c>, lower-cased, with a
    /// default port dropped. Anything a browser would not report as an origin (a path, query,
    /// credentials, a wildcard) is refused rather than trimmed, because the result is written
    /// verbatim into a response header.
    /// </summary>
    /// <seealso>EmbedOriginsTests.TryNormalize_AcceptsAnOriginAndCanonicalisesIt</seealso>
    /// <seealso>EmbedOriginsTests.TryNormalize_RefusesWhatIsNotAnOrigin</seealso>
    public static bool TryNormalize(string? value, out string origin)
    {
        origin = "";
        string trimmed = value?.Trim().TrimEnd('/') ?? "";
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out Uri? uri)
            || !_schemes.Contains(uri.Scheme)
            || uri.UserInfo.Length > 0
            || uri.AbsolutePath != "/"
            || uri.Query.Length > 0
            || uri.Fragment.Length > 0
            || uri.HostNameType is not (UriHostNameType.Dns or UriHostNameType.IPv4 or UriHostNameType.IPv6))
        {
            return false;
        }

        // Browsers compare origins with the host in punycode, and a header can't carry anything else.
        string host = uri.HostNameType == UriHostNameType.Dns ? uri.IdnHost : uri.Host;
        string port = uri.IsDefaultPort ? "" : $":{uri.Port}";
        origin = $"{uri.Scheme}://{host}{port}".ToLowerInvariant();
        return true;
    }

    public static IReadOnlyList<string> Split(string? stored)
        => (stored ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);

    public static string? Join(IEnumerable<string> origins)
    {
        string joined = string.Join(' ', origins);
        return joined.Length == 0 ? null : joined;
    }

    /// <summary>The CSP <c>frame-ancestors</c> source list for <paramref name="stored"/>.</summary>
    /// <seealso>EmbedOriginsTests.FrameAncestors_RefusesEveryoneWhenNothingIsListed</seealso>
    /// <seealso>EmbedOriginsTests.FrameAncestors_ListsTheStoredOrigins</seealso>
    public static string FrameAncestors(string? stored)
        => Join(Split(stored)) ?? NoneAllowed;
}
