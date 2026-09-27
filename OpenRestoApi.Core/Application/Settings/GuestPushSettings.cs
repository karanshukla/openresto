namespace OpenRestoApi.Core.Application.Settings;

/// <summary>
/// Guest booking reminders. Bound from the <c>GuestPush</c> configuration section
/// (<c>GuestPush__ReminderLeadHours</c>, <c>GuestPush__ExpoAccessToken</c> as environment variables).
/// </summary>
public class GuestPushSettings
{
    public const string DefaultReminderLeadHours = "24,2";

    /// <summary>
    /// Optional. Expo's push service accepts unauthenticated sends by default; an EAS project
    /// that enabled "enhanced push security" requires the token minted for it.
    /// </summary>
    public string? ExpoAccessToken { get; set; }

    /// <summary>
    /// Comma-separated hours before the sitting at which a reminder goes out, e.g. "24,2".
    /// Parsed by <see cref="ReminderLeads"/>; anything unparseable falls back to the default.
    /// </summary>
    public string ReminderLeadHours { get; set; } = DefaultReminderLeadHours;

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>GuestPushSettingsTests.ReminderLeads_ParsesDistinctPositiveHoursDescending</seealso>
    /// <seealso>GuestPushSettingsTests.ReminderLeads_FallsBackToTheDefaultWhenNothingParses</seealso>
    public IReadOnlyList<int> ReminderLeads()
    {
        List<int> parsed = Parse(ReminderLeadHours);
        return parsed.Count > 0 ? parsed : Parse(DefaultReminderLeadHours);
    }

    private static List<int> Parse(string? value) =>
        (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => int.TryParse(part, out int hours) ? hours : 0)
            .Where(hours => hours > 0)
            .Distinct()
            .OrderByDescending(hours => hours)
            .ToList();
}
