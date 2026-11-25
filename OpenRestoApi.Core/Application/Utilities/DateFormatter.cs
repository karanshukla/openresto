using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Localised date/time formatting for customer-facing surfaces (currently the booking
/// confirmation email). Wraps the <c>dddd, d MMMM yyyy</c> / <c>h:mm tt</c> patterns previously
/// inlined in <c>BookingService.BuildConfirmationEmail</c>. Invariant culture is used so month
/// names and AM/PM markers are stable across server locales — the restaurant's timezone, not the
/// server's culture, determines the wall-clock value passed in.
/// </summary>
public static class DateFormatter
{
    /// <summary>"Saturday, 18 April 2026"</summary>
    public static string FormatLongDate(DateTime date, string locale = "en")
        => date.ToString("dddd, d MMMM yyyy", Culture(locale));

    /// <summary>"3:45 PM"</summary>
    public static string FormatTime(DateTime time, string locale = "en")
        => time.ToString(IsDutch(locale) ? "HH:mm" : "h:mm tt", Culture(locale));

    /// <summary>"3:45 PM – 5:45 PM"</summary>
    public static string FormatTimeRange(DateTime start, DateTime end, string locale = "en")
        => $"{FormatTime(start, locale)} – {FormatTime(end, locale)}";

    private static bool IsDutch(string? locale) => string.Equals(locale, "nl", StringComparison.OrdinalIgnoreCase);
    private static CultureInfo Culture(string? locale) => IsDutch(locale) ? CultureInfo.GetCultureInfo("nl-NL") : CultureInfo.InvariantCulture;
}
