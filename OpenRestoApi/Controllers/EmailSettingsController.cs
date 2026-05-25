using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/email-settings")]
[Authorize]
public class EmailSettingsController(EmailSettingsService emailSettings, AppDbContext db) : ControllerBase
{
    private readonly EmailSettingsService _emailSettings = emailSettings;
    private readonly AppDbContext _db = db;

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

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] EmailSettingsRequest req)
    {
        await _emailSettings.SaveAsync(
            req.Host, req.Port, req.Username, req.Password,
            req.EnableSsl, req.FromName, req.FromEmail, req.SendBookingConfirmations);
        return Ok(new { message = "Email settings saved." });
    }

    [HttpGet("failures")]
    public async Task<IActionResult> GetFailures()
    {
        var failures = await _db.EmailFailures
            .OrderByDescending(f => f.AttemptedAt)
            .Take(50)
            .Select(f => new EmailFailureResponse
            {
                Id = f.Id,
                BookingRef = f.BookingRef,
                RecipientEmail = f.RecipientEmail,
                ErrorMessage = f.ErrorMessage,
                AttemptedAt = f.AttemptedAt,
            })
            .ToListAsync();
        return Ok(failures);
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test()
    {
        try
        {
            bool ok = await _emailSettings.TestConnectionAsync();
            return ok
                ? Ok(new { message = "Connection successful." })
                : BadRequest(new { message = "Email is not configured." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Connection failed: {ex.Message}" });
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

public class EmailFailureResponse
{
    public int Id { get; set; }
    public string? BookingRef { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public DateTime AttemptedAt { get; set; }
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
