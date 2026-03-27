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
    HoldResult? PlaceHold(int restaurantId, int tableId, int sectionId, DateTime bookingDate);
    void ReleaseHold(string holdId);
    bool IsTableHeld(int tableId, DateTime bookingDate, string? excludeHoldId = null);
    HoldEntry? GetHold(string holdId);
}
