using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Cover pacing: how many more guests may start in a slot under
/// <see cref="Restaurant.MaxCoversPerSlot"/>. A slot is one step of the availability grid,
/// <c>[slotStart, slotStart + BookingSlotIntervalMinutes)</c>, and its covers are the seats of the
/// non-cancelled bookings starting inside it. Availability and booking creation both answer
/// through here, or a slot offered as open would be refused on submit.
/// </summary>
public static class CoverPacing
{
    /// <summary>
    /// Seats left in the slot starting at <paramref name="slotStartUtc"/>, never below zero, or
    /// null when the location has no cap.
    /// </summary>
    /// <seealso>CoverPacingTests.Remaining_CountsOnlyBookingsStartingInTheSlot</seealso>
    /// <seealso>CoverPacingTests.Remaining_IsNull_WithoutACap</seealso>
    public static int? Remaining(Restaurant restaurant, IEnumerable<Booking> bookings, DateTime slotStartUtc)
    {
        if (restaurant.MaxCoversPerSlot is not int cap)
        {
            return null;
        }

        DateTime slotEndUtc = slotStartUtc.AddMinutes(AvailabilityService.SlotInterval(restaurant));
        int covers = bookings
            .Where(b => !b.IsCancelled && b.Date >= slotStartUtc && b.Date < slotEndUtc)
            .Sum(b => b.Seats);
        return Math.Max(0, cap - covers);
    }

    /// <summary>
    /// Covers per slot for <paramref name="bookings"/>, earliest first, leaving out empty slots and
    /// cancelled bookings. Uses the same slot grid as the cap, so what the dashboard shows is what
    /// booking creation enforces.
    /// </summary>
    /// <seealso>CoverPacingTests.CoversBySlot_GroupsStartsIntoTheirSlots</seealso>
    public static List<(DateTime SlotStartUtc, int Covers)> CoversBySlot(Restaurant restaurant, IEnumerable<Booking> bookings)
        => bookings
            .Where(b => !b.IsCancelled)
            .GroupBy(b => SlotStartUtc(restaurant, b.Date))
            .OrderBy(g => g.Key)
            .Select(g => (g.Key, g.Sum(b => b.Seats)))
            .ToList();

    /// <summary>
    /// The start of the availability slot <paramref name="bookingUtc"/> falls in. The grid runs
    /// from the opening of the service the sitting belongs to, so a sitting after midnight is
    /// measured from the previous day's opening. A client that posts an off-grid time still lands
    /// in the slot availability counts it against.
    /// </summary>
    /// <seealso>CoverPacingTests.SlotStartUtc_FloorsAnOffGridTimeToItsSlot</seealso>
    /// <seealso>CoverPacingTests.SlotStartUtc_MeasuresAnAfterMidnightSittingFromThePreviousOpening</seealso>
    public static DateTime SlotStartUtc(Restaurant restaurant, DateTime bookingUtc)
    {
        DateTime local = TimeZoneHelper.ConvertUtcToLocal(bookingUtc, restaurant.Timezone);
        DateTime open = ServiceWindowHelper.LocalWindowFor(restaurant, local.Date, IsoDay.Of(local.Date)).Start;
        if (local < open)
        {
            DateTime dayBefore = local.Date.AddDays(-1);
            open = ServiceWindowHelper.LocalWindowFor(restaurant, dayBefore, IsoDay.Of(dayBefore)).Start;
        }

        int interval = AvailabilityService.SlotInterval(restaurant);
        int steps = (int)Math.Floor((local - open).TotalMinutes / interval);
        return TimeZoneHelper.ConvertLocalToUtc(open.AddMinutes(steps * interval), restaurant.Timezone);
    }
}
