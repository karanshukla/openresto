using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

/// <summary>
/// The read-only half of the outgoing-email surface, split off from
/// <see cref="EmailSettingsController"/> so a key can be told whether mail works without being
/// able to see or change how it is configured. Booking confirmations are best-effort by design —
/// <c>BookingConfirmationService</c> records the failure and lets the booking through — so an
/// integration creating bookings by key otherwise has no way to discover its guests are
/// receiving nothing (issue #407).
/// <para>
/// Shares the <c>api/admin/email-settings</c> route prefix rather than sitting under a path of
/// its own: the split is about who may read what, not about the resource being a different one.
/// </para>
/// </summary>
[ApiController]
[Route("api/admin/email-settings")]
[Authorize(Policy = AuthPolicies.RequireAdmin)]
[RequiresScope(ApiKeyScopes.Email, ApiKeyScopes.Read)]
public class EmailStatusController(
    EmailSettingsService emailSettings,
    ICurrentUserService currentUser,
    EmailPreviewService emailPreview) : ControllerBase
{
    private readonly EmailSettingsService _emailSettings = emailSettings;
    private readonly ICurrentUserService _currentUser = currentUser;
    private readonly EmailPreviewService _emailPreview = emailPreview;

    /// <summary>
    /// Whether outgoing mail can be sent at all, and whether booking confirmations are switched
    /// on — two different causes with the same visible effect (guests receive nothing), which a
    /// script has to be able to tell apart. Carries no host, username or password, masked or
    /// otherwise.
    /// </summary>
    /// <seealso>EmailStatusControllerTests.Status_WhenUnconfigured_ReportsNotConfigured</seealso>
    /// <seealso>EmailStatusControllerTests.Status_WhenConfiguredWithConfirmationsOff_SeparatesTheTwoCauses</seealso>
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        EmailSettings? settings = await _emailSettings.GetAsync();
        return Ok(new EmailStatusResponse
        {
            IsConfigured = settings != null,
            SendBookingConfirmations = settings?.SendBookingConfirmations ?? false,
            FromEmail = settings?.FromEmail,
        });
    }

    /// <summary>
    /// Recent delivery failures. The recipient is a customer's email address, so it goes through
    /// the same <see cref="BookingGuestVisibility"/> gate a booking read does — otherwise a key
    /// holding <c>email:read</c> but not <c>guests:read</c> would read guest identities out of
    /// the failure list that the booking endpoints redact.
    /// </summary>
    /// <seealso>EmailStatusControllerTests.Failures_WithoutGuestScope_RedactsTheRecipient</seealso>
    /// <seealso>EmailStatusControllerTests.Failures_WithGuestScope_KeepsTheRecipient</seealso>
    [HttpGet("failures")]
    public async Task<IActionResult> GetFailures()
    {
        IReadOnlyList<EmailFailure> failures = await _emailSettings.GetFailuresAsync();
        bool redact = BookingGuestVisibility.IsRedactedFor(_currentUser);
        var response = failures.Select(f => new EmailFailureResponse
        {
            Id = f.Id,
            BookingRef = f.BookingRef,
            RecipientEmail = redact ? null : f.RecipientEmail,
            ErrorMessage = f.ErrorMessage,
            AttemptedAt = f.AttemptedAt,
        });
        return Ok(response);
    }

    /// <summary>
    /// The booking confirmation as a guest would receive it, rendered from a stand-in booking at
    /// <paramref name="restaurantId"/> (the first location when none is named). Nothing is sent
    /// and nothing is stored; the sample carries no real customer, so it needs no
    /// <see cref="BookingGuestVisibility"/> gate.
    /// </summary>
    /// <seealso>EmailStatusControllerTests.Preview_RendersTheRequestedLocation</seealso>
    [HttpGet("preview")]
    public async Task<IActionResult> Preview([FromQuery] int? restaurantId)
        => Ok(await _emailPreview.BuildConfirmationPreviewAsync(restaurantId));
}

public class EmailStatusResponse
{
    public bool IsConfigured { get; set; }
    public bool SendBookingConfirmations { get; set; }
    public string? FromEmail { get; set; }
}

public class EmailFailureResponse
{
    public int Id { get; set; }
    public string? BookingRef { get; set; }
    public string? RecipientEmail { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
    public DateTime AttemptedAt { get; set; }
}
