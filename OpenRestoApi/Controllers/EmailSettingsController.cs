using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

// Deliberately excluded from the API-key surface entirely (issue #319): a key must never be able
// to read or change the SMTP credentials the server sends mail with, or flip
// SendBookingConfirmations. The read-only half — whether mail is configured at all, and what has
// failed to send — lives in EmailStatusController under the email:read scope instead, so an
// integration can find out its guests are receiving nothing without touching this.
[ApiController]
[Route("api/admin/email-settings")]
[Authorize(Policy = AuthPolicies.RequireAdmin)]
[NoApiKeyAccess]
public class EmailSettingsController(EmailSettingsService emailSettings) : ControllerBase
{
    private readonly EmailSettingsService _emailSettings = emailSettings;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        EmailSettings? settings = await _emailSettings.GetAsync();
        if (settings == null)
        {
            return Ok(new EmailSettingsResponse());
        }

        return Ok(new EmailSettingsResponse
        {
            Host = settings.Host,
            Port = settings.Port,
            Username = settings.Username,
            Password = "••••••••",
            EnableSsl = settings.EnableSsl,
            FromName = settings.FromName,
            FromEmail = settings.FromEmail,
            IsConfigured = true,
            SendBookingConfirmations = settings.SendBookingConfirmations,
        });
    }

    [HttpPatch]
    public async Task<IActionResult> Save([FromBody] EmailSettingsRequest req)
    {
        await _emailSettings.SaveAsync(
            req.Host, req.Port, req.Username, req.Password,
            req.EnableSsl, req.FromName, req.FromEmail, req.SendBookingConfirmations);
        return Ok(new { message = "Email settings saved." });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test()
    {
        try
        {
            bool ok = await _emailSettings.TestConnectionAsync();
            return ok
                ? Ok(new { message = "Connection successful." })
                : BadRequest(new MessageResponse { Message = "Email is not configured.", Code = ErrorCodes.EmailNotConfigured });
        }
        catch (Exception ex)
        {
            return BadRequest(new MessageResponse
            {
                Message = $"Connection failed: {ex.Message}",
                Code = ErrorCodes.EmailConnectionFailed,
                Args = new Dictionary<string, object> { ["detail"] = ex.Message }
            });
        }
    }
}

public class EmailSettingsRequest
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public bool SendBookingConfirmations { get; set; }
}

public class EmailSettingsResponse
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public bool IsConfigured { get; set; }
    public bool SendBookingConfirmations { get; set; }
}
