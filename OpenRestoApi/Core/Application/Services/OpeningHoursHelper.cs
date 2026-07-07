using System.Text.Json;
using System.Text.Json.Serialization;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Resolves a restaurant's opening hours for a given ISO day (1=Monday … 7=Sunday).
/// Per-day overrides are stored as JSON in <see cref="Restaurant.OpenHoursJson"/>
/// (e.g. {"1":{"open":"12:00","close":"22:00"}}); days without an override fall
/// back to the restaurant-wide OpenTime/CloseTime. OpenDays remains the canonical
/// open/closed toggle per day — hours are only consulted for open days.
/// </summary>
public static class OpeningHoursHelper
{
    public class DayHours
    {
        [JsonPropertyName("open")]
        public string Open { get; set; } = "09:00";

        [JsonPropertyName("close")]
        public string Close { get; set; } = "22:00";
    }

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static (string Open, string Close) GetHoursForDay(Restaurant restaurant, int isoDay)
    {
        Dictionary<int, DayHours>? overrides = Parse(restaurant.OpenHoursJson);
        if (overrides != null
            && overrides.TryGetValue(isoDay, out DayHours? hours)
            && IsValidTime(hours.Open)
            && IsValidTime(hours.Close))
        {
            return (hours.Open, hours.Close);
        }

        return (restaurant.OpenTime, restaurant.CloseTime);
    }

    /// <summary>
    /// Full week of resolved hours (always 7 entries, day 1..7) for API responses.
    /// </summary>
    public static List<DayHoursDto> ResolveWeek(Restaurant restaurant)
    {
        var week = new List<DayHoursDto>(7);
        for (int day = 1; day <= 7; day++)
        {
            (string open, string close) = GetHoursForDay(restaurant, day);
            week.Add(new DayHoursDto { Day = day, Open = open, Close = close });
        }

        return week;
    }

    /// <summary>
    /// Validates and applies per-day hours from an update request. When every day
    /// of the week ends up with the same hours, they collapse back into the uniform
    /// OpenTime/CloseTime pair and the JSON override column is cleared.
    /// </summary>
    public static void ApplyOpenHours(Restaurant restaurant, List<DayHoursDto> openHours)
    {
        if (openHours.Count == 0)
        {
            restaurant.OpenHoursJson = null;
            return;
        }

        var byDay = new Dictionary<int, DayHours>();
        foreach (DayHoursDto entry in openHours)
        {
            if (entry.Day < 1 || entry.Day > 7)
            {
                throw new ValidationException("OpenHours entries must use ISO day numbers 1 (Monday) through 7 (Sunday).");
            }

            if (byDay.ContainsKey(entry.Day))
            {
                throw new ValidationException($"OpenHours contains more than one entry for day {entry.Day}.");
            }

            if (!TryParseTime(entry.Open, out int openH, out int openM)
                || !TryParseTime(entry.Close, out int closeH, out int closeM))
            {
                throw new ValidationException("OpenHours times must be valid HH:mm values (00:00–23:59).");
            }

            byDay[entry.Day] = new DayHours
            {
                Open = FormatTime(openH, openM),
                Close = FormatTime(closeH, closeM)
            };
        }

        // Fill any missing days with the currently-effective hours so a partial
        // update never silently changes the untouched days.
        for (int day = 1; day <= 7; day++)
        {
            if (!byDay.ContainsKey(day))
            {
                (string open, string close) = GetHoursForDay(restaurant, day);
                byDay[day] = new DayHours { Open = open, Close = close };
            }
        }

        DayHours first = byDay[1];
        bool uniform = byDay.Values.All(h => h.Open == first.Open && h.Close == first.Close);
        if (uniform)
        {
            restaurant.OpenTime = first.Open;
            restaurant.CloseTime = first.Close;
            restaurant.OpenHoursJson = null;
        }
        else
        {
            restaurant.OpenHoursJson = JsonSerializer.Serialize(
                byDay.OrderBy(kv => kv.Key)
                    .ToDictionary(kv => kv.Key.ToString(System.Globalization.CultureInfo.InvariantCulture), kv => kv.Value));
        }
    }

    public static Dictionary<int, DayHours>? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            var raw = JsonSerializer.Deserialize<Dictionary<string, DayHours>>(json, _jsonOptions);
            if (raw == null)
            {
                return null;
            }

            var result = new Dictionary<int, DayHours>();
            foreach ((string key, DayHours value) in raw)
            {
                if (int.TryParse(key, out int day) && day >= 1 && day <= 7 && value != null)
                {
                    result[day] = value;
                }
            }

            return result.Count > 0 ? result : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static bool IsValidTime(string? time) => TryParseTime(time, out _, out _);

    public static bool TryParseTime(string? time, out int hour, out int minute)
    {
        hour = 0;
        minute = 0;
        if (string.IsNullOrEmpty(time))
        {
            return false;
        }

        string[] parts = time.Split(':');
        if (parts.Length < 2)
        {
            return false;
        }

        return int.TryParse(parts[0], out hour)
            && int.TryParse(parts[1], out minute)
            && hour >= 0 && hour <= 23
            && minute >= 0 && minute <= 59;
    }

    private static string FormatTime(int hour, int minute) =>
        $"{hour:D2}:{minute:D2}";
}
