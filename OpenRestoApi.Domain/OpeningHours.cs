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

        /// <summary>
        /// The latest start a booking may have on this day, as HH:mm inside the day's service
        /// window. Null means bookings run up to <see cref="Close"/>.
        /// </summary>
        [JsonPropertyName("lastBooking")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? LastBooking { get; set; }
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
    /// The last booking time for <paramref name="isoDay"/>: the day's own override when it
    /// carries one, otherwise <see cref="Restaurant.LastBookingTime"/>, otherwise null, which
    /// means bookings run up to closing time. Whether the value sits inside the day's window is
    /// <c>ServiceWindowHelper</c>'s question; this only answers which value applies.
    /// </summary>
    /// <seealso>OpeningHoursHelperTests.GetLastBookingForDay_UsesTheDaysOverride</seealso>
    /// <seealso>OpeningHoursHelperTests.GetLastBookingForDay_FallsBackToTheRestaurantWideValue</seealso>
    /// <seealso>OpeningHoursHelperTests.GetLastBookingForDay_IsNullWhenNothingIsSet</seealso>
    public static string? GetLastBookingForDay(Restaurant restaurant, int isoDay)
    {
        Dictionary<int, DayHours>? overrides = Parse(restaurant.OpenHoursJson);
        if (overrides != null
            && overrides.TryGetValue(isoDay, out DayHours? hours)
            && IsValidTime(hours.LastBooking))
        {
            return hours.LastBooking;
        }

        return IsValidTime(restaurant.LastBookingTime) ? restaurant.LastBookingTime : null;
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
