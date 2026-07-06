using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class HoldsController(
    IHoldService holdService,
    IHoldPolicyService holdPolicyService) : ControllerBase
{
    private readonly IHoldService _holdService = holdService;
    private readonly IHoldPolicyService _holdPolicyService = holdPolicyService;

    /// <summary>
    /// Places a temporary hold on a table for a given date.
    /// Returns 409 Conflict if the table is already held by someone else.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PlaceHold([FromBody] PlaceHoldRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        HoldPolicyResult policy = await _holdPolicyService.ValidateAsync(
            request.RestaurantId, request.TableId, request.Date);

        return policy.Status switch
        {
            HoldPolicyStatus.NotFound => NotFound(new MessageResponse { Message = "Restaurant not found." }),
            HoldPolicyStatus.Rejected => BadRequest(new MessageResponse { Message = policy.FailureMessage! }),
            HoldPolicyStatus.Booked => Conflict(new MessageResponse { Message = policy.FailureMessage! }),
            _ => PlaceEligibleHold(request, policy)
        };
    }

    private IActionResult PlaceEligibleHold(PlaceHoldRequest request, HoldPolicyResult policy)
    {
        HoldResult? result = _holdService.PlaceHold(
            request.RestaurantId,
            request.TableId,
            request.SectionId,
            policy.BookingDate,
            request.CurrentHoldId,
            policy.Restaurant!.DefaultBookingDurationMinutes);

        if (result == null)
        {
            return Conflict(new MessageResponse { Message = "This table is already held by another user. Please select a different table or try again shortly." });
        }

        return Ok(new HoldResponse
        {
            HoldId = result.HoldId,
            ExpiresAt = result.ExpiresAt
        });
    }

    /// <summary>
    /// Releases a hold early (e.g., when the user navigates away).
    /// Safe to call even if the hold has already expired.
    /// </summary>
    [HttpDelete("{holdId}")]
    public IActionResult ReleaseHold(string holdId)
    {
        _holdService.ReleaseHold(holdId);
        return NoContent();
    }
}
