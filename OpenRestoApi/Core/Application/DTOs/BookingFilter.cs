namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// Filter parameters for the admin bookings grid query. Mirrors the arguments of
/// <c>AdminService.GetBookingsAsync</c>; consumers build this record and hand it to
/// <see cref="Interfaces.IBookingFilterRepository.QueryAsync"/> so the service stays
/// free of IQueryable / .Where / .Include chains.
/// </summary>
public sealed class BookingFilter
{
    public int? RestaurantId { get; init; }
    public DateTime? BookingDate { get; init; }
    /// <summary>Raw status string from the API ("active"|"past"|"cancelled"|"all"|"upcoming").</summary>
    public string Status { get; init; } = "active";
    public string? Email { get; init; }
    public string? BookingRef { get; init; }
}
