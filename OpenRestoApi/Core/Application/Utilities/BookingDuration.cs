using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Resolves when a sitting actually finishes. <see cref="Booking.EndTime"/> is nullable and rows
/// taken before it existed carry null, so anything that needs the end of a booking has to fall back
/// to the location's default duration rather than read the booking as zero-length.
/// </summary>
/// <seealso>BookingDurationTests.ResolveEnd_UsesStoredEndTime</seealso>
/// <seealso>BookingDurationTests.ResolveEnd_FallsBackToRestaurantDefaultWhenNull</seealso>
/// <seealso>BookingDurationTests.ResolveEnd_FallsBackWhenStoredEndIsNotAfterStart</seealso>
public static class BookingDuration
{
    /// <summary>Sitting length assumed when a location carries no configured default.</summary>
    public const int FallbackMinutes = 60;

    /// <summary>The sitting lengths a location may choose, for its default and for each turn time.</summary>
    public static readonly IReadOnlySet<int> AllowedMinutes =
        new HashSet<int> { 30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480 };

    /// <summary>
    /// How long a new sitting for a party of <paramref name="seats"/> holds its table: the turn
    /// time with the largest party size at or below <paramref name="seats"/>, else the location's
    /// default. Only for sittings being created; an existing booking keeps its stored
    /// <see cref="Booking.EndTime"/>.
    /// </summary>
    /// <seealso>BookingDurationTests.For_UsesTheRuleForTheLargerParty_AtItsBoundary</seealso>
    /// <seealso>BookingDurationTests.For_KeepsTheSmallerRule_OneSeatBelowTheBoundary</seealso>
    /// <seealso>BookingDurationTests.For_UsesTheDefault_BelowTheLowestRule</seealso>
    public static int For(Restaurant restaurant, int seats)
        => TurnTimesHelper.Parse(restaurant.TurnTimesJson)
            .LastOrDefault(rule => rule.MinSeats <= seats)?.Minutes
            ?? restaurant.DefaultBookingDurationMinutes;

    public static DateTime ResolveEnd(DateTime start, DateTime? endTime, int? defaultDurationMinutes)
        => endTime.HasValue && endTime.Value > start
            ? endTime.Value
            : start.AddMinutes(defaultDurationMinutes ?? FallbackMinutes);
}
