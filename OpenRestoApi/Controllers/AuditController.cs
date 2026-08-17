using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Controllers;

/// <summary>
/// The admin activity trail. Read-only by design: there is no write endpoint (entries are
/// produced by the audit middleware, never by a caller) and no delete endpoint (an admin who
/// can erase the log has no log). Rows leave only through the retention pass.
/// <para>
/// Gated <see cref="AuthPolicies.RequireOwner"/>, matching user management — "who did what" is a
/// management function, and a Manager should not be reviewing an Owner's actions by default.
/// </para>
/// </summary>
[ApiController]
[Route("api/admin/audit")]
[Authorize(Policy = AuthPolicies.RequireOwner)]
public class AuditController(AuditQueryService audit) : ControllerBase
{
    private readonly AuditQueryService _audit = audit;

    /// <summary>
    /// GET /api/admin/audit?actorUserId=1&amp;action=booking&amp;targetType=Booking&amp;restaurantId=2&amp;from=…&amp;to=…&amp;page=1&amp;pageSize=25
    /// <c>action</c> matches by prefix. Same envelope as the notification history.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetEntries(
        [FromQuery] int? actorUserId,
        [FromQuery] string? action,
        [FromQuery] string? targetType,
        [FromQuery] int? restaurantId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var query = new AuditQuery
        {
            ActorUserId = actorUserId,
            Action = action,
            TargetType = targetType,
            RestaurantId = restaurantId,
            From = from,
            To = to,
        };

        (List<AdminAuditEntryDto> items, int total) = await _audit.GetEntriesAsync(query, page, pageSize);

        return Ok(new
        {
            items,
            totalCount = total,
            page = Math.Max(1, page),
            pageSize = Math.Clamp(pageSize, AuditQueryService.MinPageSize, AuditQueryService.MaxPageSize),
        });
    }
}
