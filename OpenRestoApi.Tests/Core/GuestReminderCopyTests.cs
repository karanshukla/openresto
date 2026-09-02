using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Core;

/// <summary>
/// A reminder push is composed on the server in the locale the guest opted in under, so each
/// of the four UI languages is pinned here word for word, along with the day-relative forms
/// ("tomorrow", "today", a date) that the frontend's i18next bundle would otherwise own.
/// </summary>
public class GuestReminderCopyTests
{
    private const string Restaurant = "Bistro";
    private const string Ref = "crispy-basil-truffle";

    private static readonly DateTime Sitting = new(2026, 9, 11, 19, 30, 0);

    [Theory]
    [InlineData("en", "Your table at Bistro", "Tomorrow at 19:30", "Today at 19:30", " at 19:30", "2 guests", "Ref crispy-basil-truffle")]
    [InlineData("fr", "Votre table chez Bistro", "Demain à 19:30", "Aujourd'hui à 19:30", " à 19:30", "2 convives", "Réf. crispy-basil-truffle")]
    [InlineData("es", "Su mesa en Bistro", "Mañana a las 19:30", "Hoy a las 19:30", " a las 19:30", "2 comensales", "Ref. crispy-basil-truffle")]
    [InlineData("de", "Ihr Tisch im Bistro", "Morgen um 19:30", "Heute um 19:30", " um 19:30", "2 Gäste", "Ref. crispy-basil-truffle")]
    public void Build_UsesTheGuestsLocale(
        string locale, string title, string tomorrow, string today, string datedInfix, string guests, string reference)
    {
        (string tomorrowTitle, string tomorrowBody) = GuestReminderCopy.Build(locale, Restaurant, Sitting, Sitting.AddDays(-1).AddHours(-3), 2, Ref);
        (_, string todayBody) = GuestReminderCopy.Build(locale, Restaurant, Sitting, Sitting.AddHours(-2), 2, Ref);
        (_, string datedBody) = GuestReminderCopy.Build(locale, Restaurant, Sitting, Sitting.AddDays(-6), 2, Ref);

        Assert.Equal(title, tomorrowTitle);
        Assert.Equal($"{tomorrow} · {guests} · {reference}", tomorrowBody);
        Assert.Equal($"{today} · {guests} · {reference}", todayBody);
        Assert.Contains(datedInfix, datedBody);
        Assert.Contains("11", datedBody);
        Assert.DoesNotContain(tomorrow, datedBody);
        Assert.DoesNotContain(today, datedBody);
    }

    [Theory]
    [InlineData("en", "1 guest")]
    [InlineData("fr", "1 convive")]
    [InlineData("es", "1 comensal")]
    [InlineData("de", "1 Gast")]
    public void Build_UsesTheSingularForOneGuest(string locale, string oneGuest)
    {
        (_, string body) = GuestReminderCopy.Build(locale, Restaurant, Sitting, Sitting.AddDays(-1), 1, Ref);

        Assert.Contains($" · {oneGuest} · ", body);
    }

    [Fact]
    public void Build_MatchesTheLocaleCaseInsensitively()
    {
        (string title, _) = GuestReminderCopy.Build("FR", Restaurant, Sitting, Sitting.AddDays(-1), 2, Ref);

        Assert.Equal("Votre table chez Bistro", title);
    }

    [Theory]
    [InlineData("pt")]
    [InlineData("")]
    [InlineData(null)]
    public void Build_FallsBackToEnglishForAnUnknownLocale(string? locale)
    {
        (string title, string body) = GuestReminderCopy.Build(locale, Restaurant, Sitting, Sitting.AddDays(-1), 2, Ref);

        Assert.Equal("Your table at Bistro", title);
        Assert.Equal("Tomorrow at 19:30 · 2 guests · Ref crispy-basil-truffle", body);
    }
}
