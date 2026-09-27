using System.ComponentModel.DataAnnotations;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Application.DTOs;

public class CancelBookingByRefRequest
{
    public string Email { get; set; } = string.Empty;
}

public class BookingDto
{
    public int Id { get; set; }
    public int? TableId { get; set; }
    public int? SectionId { get; set; }

    /// <summary>
    /// When set, this booking reserves a combinable-table group (#272) instead of a single table.
    /// <see cref="MemberTableIds"/> carries the group's member ids for the conflict check; both are
    /// resolved server-side. Only <see cref="TableGroupId"/> is persisted on the booking entity.
    /// </summary>
    public int? TableGroupId { get; set; }

    /// <summary>
    /// Member table ids the server resolved for <see cref="TableGroupId"/> while auto-assigning.
    /// Never read back from a client request — the booking path always re-resolves the members from
    /// the persisted group, so a caller can't shrink this list to dodge a conflict check.
    /// </summary>
    public IReadOnlyList<int>? MemberTableIds { get; set; }

    public int RestaurantId { get; set; }
    public DateTime Date { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    /// <summary>Party size. Bounded to [<see cref="BookingLimits.MinSeats"/>, <see cref="BookingLimits.MaxSeats"/>] on create.</summary>
    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int Seats { get; set; }
    public bool isHeld { get; set; }
    public string? SpecialRequests { get; set; }
    public string? BookingRef { get; set; }
    public DateTime? EndTime { get; set; }

    public string? TableName { get; set; }
    public string? SectionName { get; set; }
    public int? TableSeats { get; set; }
    public bool IsCancelled { get; set; }
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// Optional hold ID obtained from POST /api/holds.
    /// Provide this when creating a booking to validate and consume the hold.
    /// Not returned in responses.
    /// </summary>
    public string? HoldId { get; set; }
}
