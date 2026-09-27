using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The words in a booking reminder, in the four UI languages. A push arrives outside the app,
/// so it cannot borrow the frontend's i18next bundle the way every other guest string does; the
/// locale the guest opted in under travels with the subscription instead.
/// </summary>
/// <seealso>GuestReminderCopyTests.Build_UsesTheGuestsLocale</seealso>
/// <seealso>GuestReminderCopyTests.Build_FallsBackToEnglishForAnUnknownLocale</seealso>
public static class GuestReminderCopy
{
    private sealed record Strings(
        string Title,
        string Tomorrow,
        string Today,
        string OnDate,
        string GuestsOne,
        string GuestsMany,
        string Reference);

    private static readonly Dictionary<string, Strings> Copy = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = new("Your table at {0}", "Tomorrow at {0}", "Today at {0}", "{0} at {1}", "1 guest", "{0} guests", "Ref {0}"),
        ["fr"] = new("Votre table chez {0}", "Demain à {0}", "Aujourd'hui à {0}", "{0} à {1}", "1 convive", "{0} convives", "Réf. {0}"),
        ["es"] = new("Su mesa en {0}", "Mañana a las {0}", "Hoy a las {0}", "{0} a las {1}", "1 comensal", "{0} comensales", "Ref. {0}"),
        ["de"] = new("Ihr Tisch im {0}", "Morgen um {0}", "Heute um {0}", "{0} um {1}", "1 Gast", "{0} Gäste", "Ref. {0}"),
    };

    private static readonly Dictionary<string, CultureInfo> Cultures = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = CultureInfo.GetCultureInfo("en-GB"),
        ["fr"] = CultureInfo.GetCultureInfo("fr-FR"),
        ["es"] = CultureInfo.GetCultureInfo("es-ES"),
        ["de"] = CultureInfo.GetCultureInfo("de-DE"),
    };

    public static (string Title, string Body) Build(
        string? locale,
        string restaurantName,
        DateTime bookingLocal,
        DateTime nowLocal,
        int seats,
        string bookingRef)
    {
        string key = locale is not null && Copy.ContainsKey(locale) ? locale : "en";
        Strings s = Copy[key];
        CultureInfo culture = Cultures[key];

        string time = bookingLocal.ToString("t", culture);
        int daysAway = (bookingLocal.Date - nowLocal.Date).Days;
        string when = daysAway switch
        {
            0 => string.Format(culture, s.Today, time),
            1 => string.Format(culture, s.Tomorrow, time),
            _ => string.Format(culture, s.OnDate, bookingLocal.ToString("ddd d MMM", culture), time),
        };
        string guests = seats == 1 ? s.GuestsOne : string.Format(culture, s.GuestsMany, seats);

        return (
            string.Format(culture, s.Title, restaurantName),
            $"{when} · {guests} · {string.Format(culture, s.Reference, bookingRef)}");
    }
}
