using System.Text.Json;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The API side of <see cref="OpeningHours"/>: the resolved week handed to clients, and the
/// validated write of per-day hours from an update request.
/// </summary>
public static class OpeningHoursHelper
{
    /// <summary>
    /// Full week of resolved hours (always 7 entries, day 1..7) for API responses.
    /// </summary>
    public static List<DayHoursDto> ResolveWeek(Restaurant restaurant)
    {
        var week = new List<DayHoursDto>(7);
        for (int day = 1; day <= 7; day++)
        {
            (string open, string close) = OpeningHours.GetHoursForDay(restaurant, day);
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

        var byDay = new Dictionary<int, OpeningHours.DayHours>();
        foreach (DayHoursDto entry in openHours)
        {
            if (entry.Day < 1 || entry.Day > 7)
            {
                throw new ValidationException("OpenHours entries must use ISO day numbers 1 (Monday) through 7 (Sunday).") { Code = ErrorCodes.RestaurantOpenHoursDayInvalid };
            }

            if (byDay.ContainsKey(entry.Day))
            {
                throw new ValidationException($"OpenHours contains more than one entry for day {entry.Day}.") { Code = ErrorCodes.RestaurantOpenHoursDuplicateDay, Args = new Dictionary<string, object> { ["day"] = entry.Day } };
            }

            if (!OpeningHours.TryParseTime(entry.Open, out int openH, out int openM)
                || !OpeningHours.TryParseTime(entry.Close, out int closeH, out int closeM))
            {
                throw new ValidationException("OpenHours times must be valid HH:mm values (00:00–23:59).") { Code = ErrorCodes.RestaurantOpenHoursTimeInvalid };
            }

            byDay[entry.Day] = new OpeningHours.DayHours
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
                (string open, string close) = OpeningHours.GetHoursForDay(restaurant, day);
                byDay[day] = new OpeningHours.DayHours { Open = open, Close = close };
            }
        }

        OpeningHours.DayHours first = byDay[1];
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

    private static string FormatTime(int hour, int minute) =>
        $"{hour:D2}:{minute:D2}";
}
