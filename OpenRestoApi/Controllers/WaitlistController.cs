using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Extensions;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

[ApiController]
[EnableRateLimiting("public")]
public class WaitlistController(WaitlistService waitlistService) : ControllerBase
{
    private readonly WaitlistService _waitlist = waitlistService;

    // Joining creates a row, so it takes the tight booking-lookup ceiling rather than the
    // browsing one. Status is polled while the guest waits and stays on "public"; the entry
    // reference is 100 bits of CSPRNG output, so it is not worth guessing at either rate.
    // <seealso>WaitlistControllerTests.Join_CarriesTheTightLookupPolicy</seealso>
    [HttpPost("api/restaurants/{restaurantId:int}/waitlist")]
    [EnableRateLimiting(ServiceCollectionExtensions.BookingLookupPolicy)]
    public async Task<IActionResult> Join(int restaurantId, [FromBody] JoinWaitlistRequest req)
    {
        WaitlistStatusDto status = await _waitlist.JoinAsync(restaurantId, req);
        return CreatedAtAction(nameof(GetStatus), new { entryRef = status.Ref }, status);
    }

    [HttpGet("api/restaurants/{restaurantId:int}/waitlist")]
    public async Task<IActionResult> GetQuote(int restaurantId, [FromQuery] int seats = 2)
    {
        return Ok(await _waitlist.GetQuoteAsync(restaurantId, Math.Clamp(seats, BookingLimits.MinSeats, BookingLimits.MaxSeats)));
    }

    [HttpGet("api/waitlist/{entryRef}")]
    public async Task<IActionResult> GetStatus(string entryRef)
    {
        WaitlistStatusDto? status = await _waitlist.GetStatusAsync(entryRef);
        return status == null ? EntryNotFound() : Ok(status);
    }

    [HttpPost("api/waitlist/{entryRef}/leave")]
    public async Task<IActionResult> Leave(string entryRef)
    {
        return await _waitlist.LeaveAsync(entryRef) ? NoContent() : EntryNotFound();
    }

    [HttpPut("api/waitlist/{entryRef}/push")]
    public async Task<IActionResult> SetPush(string entryRef, [FromBody] WaitlistPushRequest req)
    {
        return await _waitlist.SetPushAsync(entryRef, req) ? NoContent() : EntryNotFound();
    }

    [HttpGet("api/admin/restaurants/{restaurantId:int}/waitlist")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read)]
    public async Task<IActionResult> GetBoard(int restaurantId)
    {
        return Ok(await _waitlist.GetBoardAsync(restaurantId));
    }

    [HttpPost("api/admin/restaurants/{restaurantId:int}/waitlist")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
    public async Task<IActionResult> AddByStaff(int restaurantId, [FromBody] JoinWaitlistRequest req)
    {
        WaitlistEntryDto entry = await _waitlist.AddByStaffAsync(restaurantId, req);
        return CreatedAtAction(nameof(GetBoard), new { restaurantId }, entry);
    }

    [HttpPost("api/admin/waitlist/{id:int}/notify")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
    public async Task<IActionResult> Notify(int id)
    {
        await _waitlist.NotifyAsync(id);
        return NoContent();
    }

    [HttpPost("api/admin/waitlist/{id:int}/seat")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
    public async Task<IActionResult> Seat(int id, [FromBody] SeatWaitlistEntryRequest req)
    {
        return Ok(await _waitlist.SeatAsync(id, req));
    }

    [HttpPost("api/admin/waitlist/{id:int}/remove")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
    public async Task<IActionResult> Remove(int id)
    {
        await _waitlist.RemoveAsync(id);
        return NoContent();
    }

    private NotFoundObjectResult EntryNotFound() =>
        NotFound(new MessageResponse { Message = "Waitlist entry not found.", Code = ErrorCodes.WaitlistNotFound });
}
