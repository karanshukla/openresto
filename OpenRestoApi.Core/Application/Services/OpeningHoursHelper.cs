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
            week.Add(new DayHoursDto
            {
                Day = day,
                Open = open,
                Close = close,
                LastBooking = OpeningHours.GetLastBookingForDay(restaurant, day),
            });
        }

        return week;
    }

    /// <summary>
    /// Validates and applies per-day hours from an update request. When every day
    /// of the week ends up with the same hours, they collapse back into the uniform
    /// OpenTime/CloseTime pair (and <see cref="Restaurant.LastBookingTime"/>) and the JSON
    /// override column is cleared. Otherwise every day, last booking time included, lives in
    /// the JSON and the restaurant-wide last booking time is cleared, so one of the two
    /// representations holds the whole week rather than each holding part of it.
    /// </summary>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_CollapsesLastBookingIntoTheRestaurantWideValue_WhenUniform</seealso>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_KeepsTheWeekCustom_WhenOnlyTheLastBookingDiffers</seealso>
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

            string open = FormatTime(openH, openM);
            string close = FormatTime(closeH, closeM);
            byDay[entry.Day] = new OpeningHours.DayHours
            {
                Open = open,
                Close = close,
                LastBooking = NormalizeLastBooking(open, close, entry.LastBooking),
            };
        }

        // Fill any missing days with the currently-effective hours so a partial
        // update never silently changes the untouched days.
        for (int day = 1; day <= 7; day++)
        {
            if (!byDay.ContainsKey(day))
            {
                (string open, string close) = OpeningHours.GetHoursForDay(restaurant, day);
                byDay[day] = new OpeningHours.DayHours
                {
                    Open = open,
                    Close = close,
                    LastBooking = OpeningHours.GetLastBookingForDay(restaurant, day),
                };
            }
        }

        OpeningHours.DayHours first = byDay[1];
        bool uniform = byDay.Values.All(h => h.Open == first.Open && h.Close == first.Close && h.LastBooking == first.LastBooking);
        if (uniform)
        {
            restaurant.OpenTime = first.Open;
            restaurant.CloseTime = first.Close;
            restaurant.LastBookingTime = first.LastBooking;
            restaurant.OpenHoursJson = null;
        }
        else
        {
            restaurant.LastBookingTime = null;
            restaurant.OpenHoursJson = JsonSerializer.Serialize(
                byDay.OrderBy(kv => kv.Key)
                    .ToDictionary(kv => kv.Key.ToString(System.Globalization.CultureInfo.InvariantCulture), kv => kv.Value));
        }
    }

    /// <summary>
    /// Applies the restaurant-wide last booking time from a PATCH-style request: an empty value
    /// clears it, anything else must be a valid HH:mm inside the uniform OpenTime/CloseTime
    /// window. Days with their own override keep their own value; see
    /// <see cref="OpeningHours.GetLastBookingForDay"/>.
    /// </summary>
    public static void ApplyLastBookingTime(Restaurant restaurant, string lastBookingTime)
        => restaurant.LastBookingTime = NormalizeLastBooking(restaurant.OpenTime, restaurant.CloseTime, lastBookingTime);

    /// <summary>
    /// The stored form of a last booking time, or null for blank. A value outside the window has
    /// no reading that is not a guess, so it is refused rather than clamped; the cutoff itself
    /// may be the opening time but never the closing time, since no sitting starts at close.
    /// </summary>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_AcceptsALastBookingAtTheOpeningTime</seealso>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_RejectsALastBookingAtTheClosingTime</seealso>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_AcceptsAnAfterMidnightLastBooking_InsideAnOvernightWindow</seealso>
    /// <seealso>OpeningHoursHelperTests.ApplyOpenHours_RejectsALastBookingInTheGapOfAnOvernightWindow</seealso>
    private static string? NormalizeLastBooking(string open, string close, string? lastBooking)
    {
        if (string.IsNullOrWhiteSpace(lastBooking))
        {
            return null;
        }

        if (!OpeningHours.TryParseTime(lastBooking, out int hour, out int minute))
        {
            throw new ValidationException("Last booking time must be a valid HH:mm value (00:00–23:59).") { Code = ErrorCodes.RestaurantOpenHoursTimeInvalid };
        }

        OpeningHours.TryParseTime(open, out int openH, out int openM);
        OpeningHours.TryParseTime(close, out int closeH, out int closeM);
        if (!ServiceWindowHelper.CoversTimeOfDay(new TimeSpan(openH, openM, 0), new TimeSpan(closeH, closeM, 0), new TimeSpan(hour, minute, 0)))
        {
            throw new ValidationException($"Last booking time must fall within that day's opening hours ({open}–{close}).")
            {
                Code = ErrorCodes.RestaurantLastBookingOutsideHours,
                Args = new Dictionary<string, object> { ["open"] = open, ["close"] = close }
            };
        }

        return FormatTime(hour, minute);
    }

    private static string FormatTime(int hour, int minute) =>
        $"{hour:D2}:{minute:D2}";
}
