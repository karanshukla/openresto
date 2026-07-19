using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class HoldsController(
    IHoldService holdService,
    IHoldPolicyService holdPolicyService,
    TableAutoAssigner autoAssigner) : ControllerBase
{
    private readonly IHoldService _holdService = holdService;
    private readonly IHoldPolicyService _holdPolicyService = holdPolicyService;
    private readonly TableAutoAssigner _autoAssigner = autoAssigner;

    /// <summary>
    /// Places a temporary hold on a table for a given date.
    /// Returns 409 Conflict if the table is already held by someone else.
    /// When <see cref="PlaceHoldRequest.TableId"/>/<see cref="PlaceHoldRequest.SectionId"/>
    /// are omitted, the server auto-assigns the best available table across all sections.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PlaceHold([FromBody] PlaceHoldRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        bool autoAssign = request.TableId is null && request.SectionId is null;
        if (request.TableId is null ^ request.SectionId is null)
        {
            return BadRequest(new MessageResponse
            {
                Message = "Specify both TableId and SectionId, or omit both for auto-assign."
            });
        }

        HoldPolicyResult policy = autoAssign
            ? await _holdPolicyService.ValidateAnyTableAsync(request.RestaurantId, request.Date)
            : await _holdPolicyService.ValidateAsync(request.RestaurantId, request.TableId!.Value, request.Date);

        return policy.Status switch
        {
            HoldPolicyStatus.NotFound => NotFound(new MessageResponse { Message = "Restaurant not found." }),
            HoldPolicyStatus.Rejected => BadRequest(new MessageResponse { Message = policy.FailureMessage! }),
            HoldPolicyStatus.Booked => Conflict(new MessageResponse { Message = policy.FailureMessage! }),
            _ => autoAssign
                ? await PlaceAutoAssignedHold(request, policy)
                : PlaceEligibleHold(request, policy)
        };
    }

    private IActionResult PlaceEligibleHold(PlaceHoldRequest request, HoldPolicyResult policy)
    {
        HoldResult? result = _holdService.PlaceHold(
            request.RestaurantId,
            request.TableId!.Value,
            request.SectionId!.Value,
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

    private async Task<IActionResult> PlaceAutoAssignedHold(PlaceHoldRequest request, HoldPolicyResult policy)
    {
        if (request.Seats <= 0)
        {
            return BadRequest(new MessageResponse
            {
                Message = "Seats is required for auto-assign so the server can pick a table that fits your party."
            });
        }

        IReadOnlyList<TableCandidate> candidates = await _autoAssigner.BuildCandidatesAsync(
            policy.Restaurant!, request.Seats, policy.BookingDate);

        if (candidates.Count == 0)
        {
            return Conflict(new MessageResponse
            {
                Message = "No tables are available for the requested time and party size."
            });
        }

        AutoAssignResult? result = _holdService.PlaceAutoHold(
            request.RestaurantId,
            candidates,
            policy.BookingDate,
            request.CurrentHoldId,
            policy.Restaurant!.DefaultBookingDurationMinutes);

        if (result == null)
        {
            return Conflict(new MessageResponse
            {
                Message = "All suitable tables are currently being held by other users. Please try again shortly."
            });
        }

        return Ok(new HoldResponse
        {
            HoldId = result.HoldId,
            ExpiresAt = result.ExpiresAt,
            TableId = result.TableId,
            SectionId = result.SectionId
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
