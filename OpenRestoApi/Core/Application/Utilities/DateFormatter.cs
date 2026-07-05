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
    public static string FormatLongDate(DateTime date)
        => date.ToString("dddd, d MMMM yyyy", CultureInfo.InvariantCulture);

    /// <summary>"3:45 PM"</summary>
    public static string FormatTime(DateTime time)
        => time.ToString("h:mm tt", CultureInfo.InvariantCulture);

    /// <summary>"3:45 PM – 5:45 PM"</summary>
    public static string FormatTimeRange(DateTime start, DateTime end)
        => $"{FormatTime(start)} – {FormatTime(end)}";
}
