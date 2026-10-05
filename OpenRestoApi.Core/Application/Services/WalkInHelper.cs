using System.Globalization;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Validates <see cref="Restaurant.WalkInDays"/> on its way in. Reading the policy back is
/// <see cref="WalkInPolicy"/>.
/// </summary>
public static class WalkInHelper
{
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
                throw new ValidationException("WalkInDays must be a comma-separated list of ISO day numbers 1 (Monday) through 7 (Sunday).") { Code = ErrorCodes.RestaurantWalkInDaysInvalid };
            }

            days.Add(day);
        }

        return days.Count == 0
            ? null
            : string.Join(",", days.Select(d => d.ToString(CultureInfo.InvariantCulture)));
    }
}
