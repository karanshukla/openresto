using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Encapsulates the multi-filter bookings grid query (<c>GET /admin/bookings</c>).
/// Implementations resolve status normalization, grid-mode date semantics, restaurant
/// timezone day ranges, and case-insensitive email / booking-ref substring matches,
/// returning materialized <see cref="Booking"/> entities with Restaurant/Section/Table
/// navigation properties populated, ordered by <see cref="Booking.Date"/> ascending.
/// </summary>
public interface IBookingFilterRepository
{
    Task<List<Booking>> QueryAsync(BookingFilter filter);
}
