using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The words in a "your table is ready" email and push, in the four UI languages. Like
/// <see cref="GuestReminderCopy"/>, it goes out beyond the app's i18next bundle, so the locale
/// the guest joined under travels with the entry.
/// </summary>
/// <seealso>WaitlistReadyCopyTests.Build_UsesTheGuestsLocale</seealso>
/// <seealso>WaitlistReadyCopyTests.Build_FallsBackToEnglishForAnUnknownLocale</seealso>
/// <seealso>WaitlistReadyCopyTests.BuildPush_UsesTheGuestsLocale</seealso>
public static class WaitlistReadyCopy
{
    private sealed record Strings(string Subject, string Greeting, string Body, string Ticket, string Link);

    private static readonly Dictionary<string, Strings> Copy = new(StringComparer.OrdinalIgnoreCase)
    {
        ["en"] = new("Your table at {0} is ready", "Hi {0},", "Your table is ready. Please head to the host stand.", "Ticket #{0}", "View your place in the queue"),
        ["fr"] = new("Votre table chez {0} est prête", "Bonjour {0},", "Votre table est prête. Merci de vous présenter à l'accueil.", "Ticket n° {0}", "Voir votre place dans la file"),
        ["es"] = new("Su mesa en {0} está lista", "Hola {0}:", "Su mesa está lista. Acérquese a recepción, por favor.", "Número {0}", "Ver su lugar en la fila"),
        ["de"] = new("Ihr Tisch im {0} ist bereit", "Hallo {0},", "Ihr Tisch ist bereit. Bitte kommen Sie zum Empfang.", "Nummer {0}", "Ihren Platz in der Warteschlange ansehen"),
    };

    public static (string Subject, string Html) Build(string? locale, string restaurantName, string guestName, int number, string statusUrl)
    {
        Strings s = For(locale);
        CultureInfo culture = CultureInfo.InvariantCulture;

        string html = $"""
            <p>{Encode(string.Format(culture, s.Greeting, guestName))}</p>
            <p><strong>{Encode(s.Body)}</strong></p>
            <p>{Encode(string.Format(culture, s.Ticket, number))}</p>
            <p><a href="{Encode(statusUrl)}">{Encode(s.Link)}</a></p>
            """;

        return (string.Format(culture, s.Subject, restaurantName), html);
    }

    /// <summary>The push says what the email's subject and body say, without the greeting or link.</summary>
    public static (string Title, string Body) BuildPush(string? locale, string restaurantName, int number)
    {
        Strings s = For(locale);
        CultureInfo culture = CultureInfo.InvariantCulture;
        return (string.Format(culture, s.Subject, restaurantName), $"{string.Format(culture, s.Ticket, number)}: {s.Body}");
    }

    private static Strings For(string? locale) => Copy[locale is not null && Copy.ContainsKey(locale) ? locale : "en"];

    private static string Encode(string value) => System.Net.WebUtility.HtmlEncode(value);
}
