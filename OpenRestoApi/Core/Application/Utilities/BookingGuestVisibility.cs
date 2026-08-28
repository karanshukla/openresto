using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The single point that redacts a booking's guest identity (customer name + email) from an
/// admin read, when the caller is an API key (issue #319 Phase 2) authenticated with
/// <c>bookings:read</c> but not <see cref="ApiKeyScopes.Guests"/>. A JWT/browser session is never
/// redacted — <see cref="ICurrentUserService.HasScope"/> is unconditionally true for one — and
/// neither is a key that does hold <c>guests:read</c>. Every admin DTO carrying a booking's guest
/// identity (<see cref="BookingDetailDto"/> from <c>AdminService</c>, <see cref="BookingDto"/> from
/// the admin paths of <c>BookingService</c>/<c>BookingsController</c>,
/// <see cref="ScheduleConflictDto"/> from <c>RestaurantManagementService</c>) routes through here
/// rather than each call site re-deriving the same condition.
/// </summary>
public static class BookingGuestVisibility
{
    /// <summary>True when the caller must not see who a booking belongs to.</summary>
    public static bool IsRedactedFor(ICurrentUserService currentUser)
        => currentUser.IsApiKeyAuthenticated && !currentUser.HasScope(ApiKeyScopes.Guests, ApiKeyScopes.Read);

    public static BookingDetailDto Apply(BookingDetailDto dto, ICurrentUserService currentUser)
    {
        if (IsRedactedFor(currentUser))
        {
            dto.CustomerName = null;
            dto.CustomerEmail = null;
        }
        return dto;
    }

    public static List<BookingDetailDto> Apply(List<BookingDetailDto> dtos, ICurrentUserService currentUser)
    {
        foreach (BookingDetailDto dto in dtos)
        {
            Apply(dto, currentUser);
        }
        return dtos;
    }

    public static BookingDto Apply(BookingDto dto, ICurrentUserService currentUser)
    {
        if (IsRedactedFor(currentUser))
        {
            dto.CustomerName = null;
            dto.CustomerEmail = null;
        }
        return dto;
    }

    public static IEnumerable<BookingDto> Apply(IEnumerable<BookingDto> dtos, ICurrentUserService currentUser)
        => dtos.Select(dto => Apply(dto, currentUser));

    public static ScheduleConflictDto Apply(ScheduleConflictDto dto, ICurrentUserService currentUser)
    {
        if (IsRedactedFor(currentUser))
        {
            dto.CustomerName = null;
        }
        return dto;
    }

    public static List<ScheduleConflictDto> Apply(List<ScheduleConflictDto> dtos, ICurrentUserService currentUser)
    {
        foreach (ScheduleConflictDto dto in dtos)
        {
            Apply(dto, currentUser);
        }
        return dtos;
    }
}
