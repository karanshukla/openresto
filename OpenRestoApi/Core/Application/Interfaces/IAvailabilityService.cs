using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Computes bookable time slots for a restaurant on a given date, accounting for
/// opening hours, walk-in-only days, paused bookings, existing bookings, and table holds.
/// Walk-in-only tables, and groups containing one, are never offered, and a slot the party would
/// push over <c>Restaurant.MaxCoversPerSlot</c> is closed.
/// </summary>
public interface IAvailabilityService
{
    Task<AvailabilityResponseDto> GetAvailabilityAsync(int restaurantId, DateTime bookingDate, int seats);
}
