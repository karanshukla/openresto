using System.Globalization;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Resolves a restaurant's walk-in policy. A location is walk-in only either
/// globally (<see cref="Restaurant.WalkInOnly"/>) or on specific ISO days
/// listed in <see cref="Restaurant.WalkInDays"/> (1=Monday … 7=Sunday).
/// Walk-in-only means the location stays publicly listed but online bookings
/// and table holds are rejected.
/// </summary>
public static class WalkInHelper
{
    public static HashSet<int> ParseWalkInDays(string? walkInDays)
    {
        var result = new HashSet<int>();
        if (string.IsNullOrWhiteSpace(walkInDays))
        {
            return result;
        }

        foreach (string part in walkInDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(part, out int day) && day >= 1 && day <= 7)
            {
                result.Add(day);
            }
        }

        return result;
    }

    /// <summary>True when the restaurant does not take bookings on the given ISO day.</summary>
    public static bool IsWalkInOnlyOn(Restaurant restaurant, int isoDay)
        => restaurant.WalkInOnly || ParseWalkInDays(restaurant.WalkInDays).Contains(isoDay);

    /// <summary>True when the restaurant does not take bookings at the given UTC instant.</summary>
    public static bool IsWalkInOnlyAt(Restaurant restaurant, DateTime utc)
    {
        if (restaurant.WalkInOnly)
        {
            return true;
        }

        HashSet<int> days = ParseWalkInDays(restaurant.WalkInDays);
        if (days.Count == 0)
        {
            return false;
        }

        DateTime local = TimeZoneHelper.ConvertUtcToLocal(utc, restaurant.Timezone);
        int isoDay = (int)local.DayOfWeek;
        if (isoDay == 0)
        {
            isoDay = 7; // Sunday: 0 -> 7
        }

        return days.Contains(isoDay);
    }

    /// <summary>
    /// Validates a WalkInDays update value and returns the normalized
    /// comma-separated string (or null when no days are listed).
    /// </summary>
    /// <exception cref="ArgumentException">Thrown for entries outside 1–7.</exception>
    public static string? NormalizeWalkInDays(string walkInDays)
    {
        var days = new SortedSet<int>();
        foreach (string part in walkInDays.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!int.TryParse(part, out int day) || day < 1 || day > 7)
            {
                throw new ValidationException("WalkInDays must be a comma-separated list of ISO day numbers 1 (Monday) through 7 (Sunday).");
            }

            days.Add(day);
        }

        return days.Count == 0
            ? null
            : string.Join(",", days.Select(d => d.ToString(CultureInfo.InvariantCulture)));
    }
}
