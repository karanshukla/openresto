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

/// <summary>
/// A restaurant-wide candidate table for auto-assignment ("Any section").
/// Callers pre-sort candidates by <see cref="Seats"/> ascending (then by <see cref="TableId"/>
/// for determinism) before passing them in, so the smallest fitting table wins.
/// </summary>
public record TableCandidate(int TableId, int SectionId, int Seats);

/// <summary>
/// Outcome of an auto-assign hold: the placed hold plus the table/section the server
/// resolved, so the caller can persist or display the chosen table.
/// </summary>
public record AutoAssignResult(string HoldId, DateTime ExpiresAt, int TableId, int SectionId);

public interface IHoldService
{
    HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate, string? currentHoldId = null, int durationMinutes = 60);
    void ReleaseHold(string holdId);
    bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null, int durationMinutes = 60);
    HoldEntry? GetHold(string holdId);
    int GetActiveHoldsCount();

    /// <summary>
    /// Auto-assign variant of <see cref="PlaceHold"/> for "Any section" requests. Iterates
    /// <paramref name="candidates"/> (already sorted by the caller: Seats ascending, then
    /// TableId) and places a hold on the first one that is not held by someone else, all
    /// inside the existing placement lock so the pick + hold are atomic. Returns
    /// <c>null</c> if every candidate is taken. The caller's <paramref name="currentHoldId"/>
    /// is excluded from the held-check and atomically replaced, matching <see cref="PlaceHold"/>.
    /// </summary>
    AutoAssignResult? PlaceAutoHold(
        int restaurantId,
        IReadOnlyList<TableCandidate> candidates,
        DateTime bookingDate,
        string? currentHoldId = null,
        int durationMinutes = 60);
}
