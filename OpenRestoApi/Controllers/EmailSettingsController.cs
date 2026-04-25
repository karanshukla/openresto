using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/email-settings")]
[Authorize]
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
        });
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] EmailSettingsRequest req)
    {
        await _emailSettings.SaveAsync(
            req.Host, req.Port, req.Username, req.Password,
            req.EnableSsl, req.FromName, req.FromEmail);
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
}
