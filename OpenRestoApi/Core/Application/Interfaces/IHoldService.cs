namespace OpenRestoApi.Core.Application.Interfaces;

public record HoldEntry(
    string HoldId,
    int TableId,
    int SectionId,
    int RestaurantId,
    DateTime Date,
    DateTime ExpiresAt
);

public record HoldResult(string HoldId, DateTime ExpiresAt);

public interface IHoldService
{
    /// <summary>
    /// Attempts to place a hold on a table for the given date.
    /// Returns null if the table is already held or booked.
    /// </summary>
    HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate);

    /// <summary>
    /// Releases a hold by ID. Safe to call even if the hold has already expired.
    /// </summary>
    void ReleaseHold(string holdId);

    /// <summary>
    /// Returns true if a live hold exists for this table+date,
    /// optionally ignoring a specific holdId (so the hold holder isn't blocked by their own hold).
    /// </summary>
    bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null);

    /// <summary>
    /// Returns the hold entry if it exists and has not expired, otherwise null.
    /// </summary>
    HoldEntry? GetHold(string holdId);
}
