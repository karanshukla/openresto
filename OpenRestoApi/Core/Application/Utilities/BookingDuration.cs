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

    public static DateTime ResolveEnd(DateTime start, DateTime? endTime, int? defaultDurationMinutes)
        => endTime.HasValue && endTime.Value > start
            ? endTime.Value
            : start.AddMinutes(defaultDurationMinutes ?? FallbackMinutes);
}
