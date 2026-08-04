namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// A placed hold. For a single-table hold, <see cref="TableId"/> is set and <see cref="MemberTableIds"/>
/// is empty. For a combinable-table group hold (#272), <see cref="TableGroupId"/> is set and
/// <see cref="MemberTableIds"/> lists every member table the hold reserves — those tables are all
/// treated as busy (see <see cref="IHoldService.IsTableHeld"/>). One hold id releases the whole group.
/// </summary>
public record HoldEntry(
    string HoldId,
    int TableId,
    int SectionId,
    int RestaurantId,
    DateTime Date,
    DateTime ExpiresAt,
    int? TableGroupId = null,
    IReadOnlyList<int>? MemberTableIds = null
)
{
    /// <summary>True when this hold reserves a combinable-table group rather than one table.</summary>
    public bool IsGroup => TableGroupId.HasValue;

    /// <summary>Member tables reserved by this hold (empty for single-table holds).</summary>
    public IReadOnlyList<int> Members => MemberTableIds ?? Array.Empty<int>();
}

public record HoldResult(string HoldId, DateTime ExpiresAt);

/// <summary>
/// A restaurant-wide candidate for auto-assignment ("Any section"). May be a standalone table or a
/// combinable-table group (#272). Callers pre-sort candidates by <see cref="Seats"/> ascending,
/// then <see cref="IsGroup"/> (standalone tables before groups of equal capacity — the
/// "deprioritize combinable tables" rule), then <see cref="TableId"/> for determinism, before
/// passing them in, so the smallest fitting standalone table wins; a group is only chosen when no
/// standalone table fits.
/// </summary>
public record TableCandidate(
    int TableId,
    int SectionId,
    int Seats,
    bool IsGroup = false,
    int? TableGroupId = null,
    IReadOnlyList<int>? MemberTableIds = null
)
{
    /// <summary>Member tables reserved when this candidate is a group (empty for single-table).</summary>
    public IReadOnlyList<int> Members => MemberTableIds ?? Array.Empty<int>();
}

/// <summary>
/// Outcome of an auto-assign hold: the placed hold plus the table/section (or group + members) the
/// server resolved, so the caller can persist or display the chosen reservation.
/// </summary>
public record AutoAssignResult(
    string HoldId,
    DateTime ExpiresAt,
    int TableId,
    int SectionId,
    bool IsGroup = false,
    int? TableGroupId = null,
    IReadOnlyList<int>? MemberTableIds = null
)
{
    public IReadOnlyList<int> Members => MemberTableIds ?? Array.Empty<int>();
}

public interface IHoldService
{
    HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate, string? currentHoldId = null, int durationMinutes = 60);

    /// <summary>
    /// Place a hold on every member table of a combinable group as a single atomic entry, so the
    /// whole group is reserved and released together. All members must be free (no other hold
    /// overlaps); returns null otherwise. Mirrors <see cref="PlaceHold"/>'s atomic-replace-current
    /// semantics. The returned <see cref="HoldResult.HoldId"/> identifies one multi-table hold.
    /// </summary>
    HoldResult? PlaceGroupHold(
        int restaurantId,
        int tableGroupId,
        IReadOnlyList<int> memberTableIds,
        int sectionId,
        DateTime bookingDate,
        string? currentHoldId = null,
        int durationMinutes = 60);

    void ReleaseHold(string holdId);
    /// <summary>
    /// True when an active hold overlaps the window [<paramref name="bookingDate"/>,
    /// <paramref name="bookingDate"/> + <paramref name="durationMinutes"/>) on this table —
    /// <b>including</b> a group hold that reserves this table as one of its members (#272). Pass
    /// <paramref name="excludeHoldId"/> to skip the caller's own hold.
    /// </summary>
    bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null, int durationMinutes = 60);
    HoldEntry? GetHold(string holdId);
    int GetActiveHoldsCount();

    /// <summary>
    /// Auto-assign variant of <see cref="PlaceHold"/> for "Any section" requests. Iterates
    /// <paramref name="candidates"/> (already sorted by the caller: Seats ascending, IsGroup,
    /// then TableId) and places a hold on the first one that is not held by someone else, all
    /// inside the existing placement lock so the pick + hold are atomic. Group candidates place a
    /// single multi-member hold. Returns <c>null</c> if every candidate is taken. The caller's
    /// <paramref name="currentHoldId"/> is excluded from the held-check and atomically replaced,
    /// matching <see cref="PlaceHold"/>.
    /// </summary>
    AutoAssignResult? PlaceAutoHold(
        int restaurantId,
        IReadOnlyList<TableCandidate> candidates,
        DateTime bookingDate,
        string? currentHoldId = null,
        int durationMinutes = 60);
}
