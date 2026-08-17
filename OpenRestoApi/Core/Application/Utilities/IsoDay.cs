namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// ISO 8601 day numbers (1=Monday … 7=Sunday), the format every day-list column in the
/// schema uses — <c>Restaurant.OpenDays</c> and <c>Restaurant.WalkInDays</c> alike.
/// </summary>
public static class IsoDay
{
    public const int Monday = 1;
    public const int Sunday = 7;

    /// <summary>
    /// The ISO day number of <paramref name="local"/>. <see cref="DayOfWeek"/> numbers
    /// Sunday 0, so it is remapped to 7 rather than silently sorting before Monday.
    /// </summary>
    public static int Of(DateTime local)
    {
        int dayOfWeek = (int)local.DayOfWeek;
        return dayOfWeek == 0 ? Sunday : dayOfWeek;
    }

    /// <summary>
    /// Parses a comma-separated day list, discarding anything it cannot recognise. Day names
    /// are accepted alongside the numbers because hand-edited and seeded <c>OpenDays</c>
    /// values in the wild carry both, and the availability endpoint and
    /// <c>Restaurant.IsOpenAt</c> have to agree on which days a location is open — a value one
    /// of them reads as Monday and the other discards shows open slots on a closed day.
    /// Callers that must reject bad input use their own validating normalizer instead.
    /// </summary>
    /// <seealso>IsoDayTests.ParseList_ReadsDayNamesAndNumbers</seealso>
    /// <seealso>IsoDayTests.ParseList_DiscardsUnrecognisedEntries</seealso>
    public static HashSet<int> ParseList(string? csv)
    {
        var days = new HashSet<int>();
        if (string.IsNullOrWhiteSpace(csv))
        {
            return days;
        }

        foreach (string part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            int day = Parse(part);
            if (day != Unrecognised)
            {
                days.Add(day);
            }
        }

        return days;
    }

    private const int Unrecognised = 0;

    private static int Parse(string day)
    {
        if (int.TryParse(day, out int number))
        {
            return number >= Monday && number <= Sunday ? number : Unrecognised;
        }

        return day.ToLowerInvariant() switch
        {
            "mon" or "monday" => 1,
            "tue" or "tues" or "tuesday" => 2,
            "wed" or "wednesday" => 3,
            "thu" or "thurs" or "thursday" => 4,
            "fri" or "friday" => 5,
            "sat" or "saturday" => 6,
            "sun" or "sunday" => Sunday,
            _ => Unrecognised
        };
    }
}
