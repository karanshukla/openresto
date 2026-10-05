namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Resolves a restaurant's walk-in policy. A location is walk-in only either
/// globally (<see cref="Restaurant.WalkInOnly"/>) or on specific ISO days
/// listed in <see cref="Restaurant.WalkInDays"/> (1=Monday … 7=Sunday).
/// Walk-in-only means the location stays publicly listed but online bookings
/// and table holds are rejected.
/// </summary>
public static class WalkInPolicy
{
    public static HashSet<int> ParseWalkInDays(string? walkInDays) => IsoDay.ParseList(walkInDays);

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
        return days.Contains(IsoDay.Of(local));
    }
}
