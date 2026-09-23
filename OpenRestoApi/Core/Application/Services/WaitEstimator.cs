using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Predicts when each party in a waitlist gets a table by replaying the queue against the floor.
/// A table is free from the end of whatever sitting occupies it now; each party, in queue order,
/// takes the fitting unit that frees up first, and holds it for one default sitting. A later
/// party can therefore be quoted a shorter wait than an earlier one when a small table turns
/// before a large one, which is how a host actually seats the door.
/// </summary>
public static class WaitEstimator
{
    private sealed record Unit(int Seats, bool IsGroup, IReadOnlyList<int> TableIds);

    /// <summary>
    /// The seating instant for each of <paramref name="partySizes"/>, in the same order, or null
    /// for a party no table or group at the location can seat. <paramref name="tableFreeAtUtc"/>
    /// maps each occupied table to when it frees up; a table missing from it is free now.
    /// </summary>
    /// <seealso>WaitEstimatorTests.Estimate_SeatsAtOnce_WhenAFittingTableIsFree</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_WaitsForTheSittingThatEndsFirst</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_QueuesASecondPartyBehindTheFirst</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_LetsASmallPartyOvertakeALargeOne</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_IsNull_ForAPartyNothingCanSeat</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_UsesAGroup_OnlyOnceAllItsMembersAreFree</seealso>
    /// <seealso>WaitEstimatorTests.Estimate_RespectsTheOversizeCap</seealso>
    public static IReadOnlyList<DateTime?> EstimateSeatingTimes(
        Restaurant restaurant,
        IReadOnlyList<int> partySizes,
        IReadOnlyDictionary<int, DateTime> tableFreeAtUtc,
        DateTime nowUtc)
    {
        List<Unit> units = UnitsOf(restaurant);
        var freeAt = new Dictionary<int, DateTime>(tableFreeAtUtc);
        TimeSpan sitting = TimeSpan.FromMinutes(restaurant.DefaultBookingDurationMinutes);

        var estimates = new List<DateTime?>(partySizes.Count);
        foreach (int seats in partySizes)
        {
            var fitting = units
                .Where(u => restaurant.CanSeat(u.Seats, seats))
                .Select(u => (Unit: u, Start: FreeFrom(u, freeAt, nowUtc)))
                .OrderBy(c => c.Start)
                .ThenBy(c => c.Unit.Seats)
                .ThenBy(c => c.Unit.IsGroup)
                .ToList();

            if (fitting.Count == 0)
            {
                estimates.Add(null);
                continue;
            }

            var chosen = fitting[0];

            foreach (int tableId in chosen.Unit.TableIds)
            {
                freeAt[tableId] = chosen.Start + sitting;
            }
            estimates.Add(chosen.Start);
        }

        return estimates;
    }

    /// <summary>
    /// When each table in <paramref name="inProgress"/> frees up: the latest end among the
    /// sittings on it, counting a group sitting against every member table.
    /// </summary>
    /// <seealso>WaitEstimatorTests.TableFreeTimes_CountsAGroupSittingAgainstEveryMember</seealso>
    /// <seealso>WaitEstimatorTests.TableFreeTimes_FallsBackToTheDefaultSitting_WithoutAnEndTime</seealso>
    public static Dictionary<int, DateTime> TableFreeTimes(Restaurant restaurant, IEnumerable<Booking> inProgress)
    {
        var freeAt = new Dictionary<int, DateTime>();
        foreach (Booking booking in inProgress)
        {
            DateTime end = booking.EndTime ?? booking.Date.AddMinutes(restaurant.DefaultBookingDurationMinutes);
            foreach (int tableId in TablesOf(booking, restaurant))
            {
                freeAt[tableId] = freeAt.TryGetValue(tableId, out DateTime existing) && existing > end ? existing : end;
            }
        }
        return freeAt;
    }

    /// <summary>Whole minutes from <paramref name="nowUtc"/> to <paramref name="seatAtUtc"/>, rounded up; zero when a table is free now.</summary>
    public static int? MinutesUntil(DateTime? seatAtUtc, DateTime nowUtc)
        => seatAtUtc is { } at ? Math.Max(0, (int)Math.Ceiling((at - nowUtc).TotalMinutes)) : null;

    private static DateTime FreeFrom(Unit unit, Dictionary<int, DateTime> freeAt, DateTime nowUtc)
    {
        DateTime latest = nowUtc;
        foreach (int tableId in unit.TableIds)
        {
            if (freeAt.TryGetValue(tableId, out DateTime at) && at > latest)
            {
                latest = at;
            }
        }
        return latest;
    }

    private static List<Unit> UnitsOf(Restaurant restaurant)
    {
        var units = restaurant.Sections
            .SelectMany(s => s.Tables)
            .Select(t => new Unit(t.Seats, IsGroup: false, new[] { t.Id }))
            .ToList();

        units.AddRange((restaurant.Groups ?? Enumerable.Empty<TableGroup>())
            .Where(g => g.Members.Count > 0)
            .Select(g => new Unit(g.CombinedSeats, IsGroup: true, g.Members.Select(m => m.TableId).ToList())));

        return units;
    }

    private static IEnumerable<int> TablesOf(Booking booking, Restaurant restaurant)
    {
        if (booking.TableId is { } tableId)
        {
            return new[] { tableId };
        }

        TableGroup? group = restaurant.Groups?.FirstOrDefault(g => g.Id == booking.TableGroupId);
        return group?.Members.Select(m => m.TableId) ?? Enumerable.Empty<int>();
    }
}
