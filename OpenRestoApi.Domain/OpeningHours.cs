using System.Text.Json;
using System.Text.Json.Serialization;

namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Resolves a restaurant's opening hours for a given ISO day (1=Monday … 7=Sunday).
/// Per-day overrides are stored as JSON in <see cref="Restaurant.OpenHoursJson"/>
/// (e.g. {"1":{"open":"12:00","close":"22:00"}}); days without an override fall
/// back to the restaurant-wide OpenTime/CloseTime. OpenDays remains the canonical
/// open/closed toggle per day — hours are only consulted for open days.
/// </summary>
public static class OpeningHours
{
    public class DayHours
    {
        [JsonPropertyName("open")]
        public string Open { get; set; } = OpeningHourDefaults.Open;

        [JsonPropertyName("close")]
        public string Close { get; set; } = OpeningHourDefaults.Close;
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
}
