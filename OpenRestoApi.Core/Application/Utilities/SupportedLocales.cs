namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The single place supported UI locales are defined. Adding a language means adding one
/// entry to <see cref="All"/> here plus one in the frontend's <c>constants/locales.ts</c>
/// mirror, the same way <see cref="UserRoles"/> is the backend half of <c>constants/roles.ts</c>.
/// </summary>
public static class SupportedLocales
{
    /// <summary>The locale served when nothing configured resolves to a supported value.</summary>
    public const string Default = "en";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "en", "fr", "es", "de" };

    public static bool IsSupported(string? locale) =>
        !string.IsNullOrWhiteSpace(locale) && All.Contains(locale.Trim());
}
