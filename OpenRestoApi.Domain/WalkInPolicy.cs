namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Resolves a restaurant's walk-in policy. A location is walk-in only either
/// globally (<see cref="Restaurant.WalkInOnly"/>), on specific ISO days
/// listed in <see cref="Restaurant.WalkInDays"/> (1=Monday … 7=Sunday), or on
/// a single date carrying a walk-in-only <see cref="DateException"/>.
/// Walk-in-only means the location stays publicly listed but online bookings
/// and table holds are rejected.
/// </summary>
public static class WalkInPolicy
{
    public static HashSet<int> ParseWalkInDays(string? walkInDays) => IsoDay.ParseList(walkInDays);

    /// <summary>
    /// True when the weekly policy takes no bookings on the given ISO day. Date exceptions are
    /// not consulted: ask <see cref="IsWalkInOnlyOn(Restaurant, DateTime)"/> about a date.
    /// </summary>
    public static bool IsWalkInOnlyOnWeekday(Restaurant restaurant, int isoDay)
        => restaurant.WalkInOnly || ParseWalkInDays(restaurant.WalkInDays).Contains(isoDay);

    /// <summary>
    /// True when the restaurant takes no online bookings on <paramref name="localDate"/>: the
    /// whole location is walk-in only, the weekday is, or the date carries a walk-in-only
    /// exception. A closed date is not walk-in only, it is closed.
    /// </summary>
    /// <seealso>WalkInTests.IsWalkInOnlyOn_TrueOnAWalkInOnlyDate</seealso>
    /// <seealso>WalkInTests.IsWalkInOnlyOn_FalseOnTheDayAfterAWalkInOnlyDate</seealso>
    public static bool IsWalkInOnlyOn(Restaurant restaurant, DateTime localDate)
    {
        if (restaurant.WalkInOnly)
        {
            return true;
        }

        return DateExceptions.For(restaurant, localDate)?.Kind switch
        {
            DateExceptionType.WalkInOnly => true,
            DateExceptionType.Closed => false,
            _ => ParseWalkInDays(restaurant.WalkInDays).Contains(IsoDay.Of(localDate)),
        };
    }

    /// <summary>True when the restaurant does not take bookings at the given UTC instant.</summary>
    public static bool IsWalkInOnlyAt(Restaurant restaurant, DateTime utc)
    {
        if (restaurant.WalkInOnly)
        {
            return true;
        }

        DateTime local = TimeZoneHelper.ConvertUtcToLocal(utc, restaurant.Timezone);
        return IsWalkInOnlyOn(restaurant, local.Date);
    }
}
