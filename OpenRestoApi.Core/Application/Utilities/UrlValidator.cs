namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Centralised absolute-URL validation. Mirrors the frontend <c>utils/validation.ts</c>
/// <c>isValidUrl</c> helper — the backend is the source of truth, the frontend check is a
/// UX pre-flight. Sibling to <see cref="EmailValidator"/>: same deliberately-strict-but-pragmatic
/// shape (a real <see cref="Uri"/> parse plus an allow-list of schemes, not a hand-rolled regex).
/// </summary>
/// <remarks>
/// <para>
/// Callers pass the set of schemes appropriate to the field. Social-link and highlight links
/// accept web + contact schemes (<c>http</c>, <c>https</c>, <c>mailto</c>, <c>tel</c>, <c>sms</c>);
/// a restaurant <c>MenuUrl</c> is a web link so it is restricted to <c>http</c>/<c>https</c>
/// (the instance's own served-menu path is a <c>/media/...</c> relative URL handled by the caller,
/// not here). Dangerous schemes (<c>javascript:</c>, <c>data:</c>) are blocked simply by virtue
/// of not being in the allow-list.
/// </para>
/// </remarks>
public static class UrlValidator
{
    /// <summary>Schemes permitted for social-link and highlight URLs (web + contact).</summary>
    public static readonly HashSet<string> WebAndContactSchemes =
        new(StringComparer.OrdinalIgnoreCase) { "http", "https", "mailto", "tel", "sms" };

    /// <summary>Schemes permitted for a web-only field such as <c>MenuUrl</c>.</summary>
    public static readonly HashSet<string> WebSchemes =
        new(StringComparer.OrdinalIgnoreCase) { "http", "https" };

    /// <summary>
    /// Returns true when <paramref name="url"/> is a non-blank, well-formed absolute URL whose
    /// scheme is in <paramref name="allowedSchemes"/> (case-insensitive). False otherwise —
    /// the caller decides whether to throw <c>ValidationException</c>.
    /// </summary>
    public static bool IsValid(string? url, HashSet<string> allowedSchemes)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return false;
        }

        // UriKind.Absolute rejects relative paths ("/media/menu.pdf"), protocol-relative URLs
        // ("//host/path"), and bare strings ("asdf"). The trailing scheme check is the security
        // gate: Uri.TryCreate happily parses "javascript:alert(1)" as a valid URI.
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out Uri? parsed))
        {
            return false;
        }

        return allowedSchemes.Contains(parsed.Scheme);
    }
}
