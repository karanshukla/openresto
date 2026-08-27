using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class HoldsController(
    IHoldService holdService,
    IHoldPolicyService holdPolicyService,
    TableAutoAssigner autoAssigner,
    ITableGroupRepository tableGroupRepository) : ControllerBase
{
    private readonly IHoldService _holdService = holdService;
    private readonly IHoldPolicyService _holdPolicyService = holdPolicyService;
    private readonly TableAutoAssigner _autoAssigner = autoAssigner;
    private readonly ITableGroupRepository _tableGroupRepository = tableGroupRepository;

    /// <summary>
    /// Places a temporary hold on a table for a given date.
    /// Returns 409 Conflict if the table is already held by someone else.
    /// When <see cref="PlaceHoldRequest.TableId"/>/<see cref="PlaceHoldRequest.SectionId"/>
    /// are omitted, the server auto-assigns the best available table across all sections.
    /// When <see cref="PlaceHoldRequest.TableGroupId"/> is set, the server reserves all member
    /// tables of that combinable group as one hold (#272).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PlaceHold([FromBody] PlaceHoldRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // A combinable-group hold takes precedence and resolves its own members.
        if (request.TableGroupId.HasValue)
        {
            // A group hold must not also specify a concrete table — that's ambiguous.
            if (request.TableId.HasValue)
            {
                return BadRequest(new MessageResponse
                {
                    Message = "Specify either TableId or TableGroupId, not both.",
                    Code = ErrorCodes.HoldAmbiguousGroupAndTable
                });
            }

            return await PlaceGroupHold(request);
        }

        bool autoAssign = request.TableId is null && request.SectionId is null;
        if (request.TableId is null ^ request.SectionId is null)
        {
            return BadRequest(new MessageResponse
            {
                Message = "Specify both TableId and SectionId, or omit both for auto-assign.",
                Code = ErrorCodes.BookingAmbiguousTableSelection
            });
        }

        HoldPolicyResult policy = autoAssign
            ? await _holdPolicyService.ValidateAnyTableAsync(request.RestaurantId, request.Date)
            : await _holdPolicyService.ValidateAsync(request.RestaurantId, request.TableId!.Value, request.Date);

        return policy.Status switch
        {
            HoldPolicyStatus.NotFound => NotFound(new MessageResponse { Message = "Restaurant not found.", Code = policy.Code }),
            HoldPolicyStatus.Rejected => BadRequest(new MessageResponse { Message = policy.FailureMessage!, Code = policy.Code, Args = policy.Args }),
            HoldPolicyStatus.Booked => Conflict(new MessageResponse { Message = policy.FailureMessage!, Code = policy.Code, Args = policy.Args }),
            _ => autoAssign
                ? await PlaceAutoAssignedHold(request, policy)
                : PlaceEligibleHold(request, policy)
        };
    }

    /// <summary>
    /// Resolves a combinable group's members and places a single multi-table hold on all of them
    /// (#272). Validates restaurant-level policy, that the group exists + belongs to the restaurant,
    /// and that the party fits within the group's CombinedSeats (and the oversize cap). The actual
    /// all-members-free check + place happens atomically inside HoldService.PlaceGroupHold's lock.
    /// </summary>
    private async Task<IActionResult> PlaceGroupHold(PlaceHoldRequest request)
    {
        HoldPolicyResult policy = await _holdPolicyService.ValidateAnyTableAsync(request.RestaurantId, request.Date);
        if (policy.Status != HoldPolicyStatus.Eligible)
        {
            return policy.Status switch
            {
                HoldPolicyStatus.NotFound => NotFound(new MessageResponse { Message = "Restaurant not found.", Code = policy.Code }),
                HoldPolicyStatus.Rejected => BadRequest(new MessageResponse { Message = policy.FailureMessage!, Code = policy.Code, Args = policy.Args }),
                HoldPolicyStatus.Booked => Conflict(new MessageResponse { Message = policy.FailureMessage!, Code = policy.Code, Args = policy.Args }),
                _ => BadRequest(new MessageResponse { Message = "Hold not available.", Code = ErrorCodes.HoldUnavailable })
            };
        }

        TableGroup? group = await _tableGroupRepository.GetByIdWithMembersAsync(request.TableGroupId!.Value, request.RestaurantId);
        if (group == null)
        {
            return NotFound(new MessageResponse { Message = "Table group not found.", Code = ErrorCodes.TableGroupNotFound });
        }

        if (request.Seats <= 0)
        {
            return BadRequest(new MessageResponse
            {
                Message = "Seats is required for a group hold so the server can validate combined capacity.",
                Code = ErrorCodes.HoldGroupSeatsRequired
            });
        }

        if (request.Seats > group.CombinedSeats)
        {
            return Conflict(new MessageResponse
            {
                Message = $"This group only has {group.CombinedSeats} combined seats, but {request.Seats} guests were requested.",
                Code = ErrorCodes.TableGroupSeatsExceeded
            });
        }

        Restaurant restaurant = policy.Restaurant!;
        if (restaurant.ExceedsOversizeCap(group.CombinedSeats, request.Seats))
        {
            return Conflict(new MessageResponse
            {
                Message = $"This group has {group.CombinedSeats} combined seats, which is too large for a party of {request.Seats}.",
                Code = ErrorCodes.TableGroupOversizeCap
            });
        }

        var memberIds = group.Members.Select(m => m.TableId).ToList();
        if (memberIds.Count == 0)
        {
            return Conflict(new MessageResponse { Message = "This table group has no members.", Code = ErrorCodes.TableGroupNoMembers });
        }

        int sectionId = group.Members.OrderBy(m => m.TableId).First().Table?.SectionId ?? 0;

        HoldResult? result = _holdService.PlaceGroupHold(
            request.RestaurantId,
            group.Id,
            memberIds,
            sectionId,
            policy.BookingDate,
            request.CurrentHoldId,
            restaurant.DefaultBookingDurationMinutes);

        if (result == null)
        {
            return Conflict(new MessageResponse
            {
                Message = "One of the combined tables is already held by another user. Please try again shortly.",
                Code = ErrorCodes.TableGroupHoldConflict
            });
        }

        return Ok(new HoldResponse
        {
            HoldId = result.HoldId,
            ExpiresAt = result.ExpiresAt,
            TableGroupId = group.Id
        });
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
            return Conflict(new MessageResponse { Message = "This table is already held by another user. Please select a different table or try again shortly.", Code = ErrorCodes.BookingTableHeld });
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
                Message = "Seats is required for auto-assign so the server can pick a table that fits your party.",
                Code = ErrorCodes.HoldAutoAssignSeatsRequired
            });
        }

        IReadOnlyList<TableCandidate> candidates = await _autoAssigner.BuildCandidatesAsync(
            policy.Restaurant!, request.Seats, policy.BookingDate);

        if (candidates.Count == 0)
        {
            return Conflict(new MessageResponse
            {
                Message = "No tables are available for the requested time and party size.",
                Code = ErrorCodes.BookingNoTablesAvailable
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
                Message = "All suitable tables are currently being held by other users. Please try again shortly.",
                Code = ErrorCodes.BookingAllTablesHeld
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
