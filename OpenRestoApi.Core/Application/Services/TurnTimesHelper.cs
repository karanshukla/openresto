using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The API side of <see cref="TurnTimes"/>: turn times as the DTOs clients send and receive, and
/// the validation an update has to pass before it is stored.
/// </summary>
public static class TurnTimesHelper
{
    /// <summary>The stored rules ordered by party size, or empty when there are none or the JSON is unreadable.</summary>
    public static List<TurnTimeDto> Parse(string? json)
        => TurnTimes.Parse(json)
            .Select(r => new TurnTimeDto { MinSeats = r.MinSeats, Minutes = r.Minutes })
            .ToList();

    /// <summary>
    /// Validates and stores the rules. An empty list clears them, so every party gets
    /// <see cref="Restaurant.DefaultBookingDurationMinutes"/> again.
    /// </summary>
    /// <seealso>TurnTimesHelperTests.Apply_Rejects_MinutesOutsideTheAllowedDurations</seealso>
    /// <seealso>TurnTimesHelperTests.Apply_Rejects_APartySizeAboveTheBookingLimit</seealso>
    /// <seealso>TurnTimesHelperTests.Apply_Rejects_TwoRulesForTheSamePartySize</seealso>
    public static void Apply(Restaurant restaurant, List<TurnTimeDto> rules)
    {
        if (rules.Count == 0)
        {
            restaurant.TurnTimesJson = null;
            return;
        }

        var seen = new HashSet<int>();
        foreach (TurnTimeDto rule in rules)
        {
            if (rule.MinSeats < BookingLimits.MinSeats || rule.MinSeats > BookingLimits.MaxSeats)
            {
                throw new ValidationException(
                    $"Turn time party sizes must be between {BookingLimits.MinSeats} and {BookingLimits.MaxSeats}.")
                {
                    Code = ErrorCodes.RestaurantTurnTimeSeatsOutOfRange,
                    Args = new Dictionary<string, object> { ["min"] = BookingLimits.MinSeats, ["max"] = BookingLimits.MaxSeats }
                };
            }

            if (!BookingDuration.AllowedMinutes.Contains(rule.Minutes))
            {
                string allowed = string.Join(", ", BookingDuration.AllowedMinutes.Order());
                throw new ValidationException($"Turn time minutes must be one of: {allowed}.")
                {
                    Code = ErrorCodes.RestaurantTurnTimeMinutesInvalid,
                    Args = new Dictionary<string, object> { ["allowed"] = allowed }
                };
            }

            if (!seen.Add(rule.MinSeats))
            {
                throw new ValidationException($"There is more than one turn time for parties of {rule.MinSeats}.")
                {
                    Code = ErrorCodes.RestaurantTurnTimeDuplicateSeats,
                    Args = new Dictionary<string, object> { ["seats"] = rule.MinSeats }
                };
            }
        }

        restaurant.TurnTimesJson = TurnTimes.Serialize(rules.Select(r => new TurnTime(r.MinSeats, r.Minutes)));
    }
}
