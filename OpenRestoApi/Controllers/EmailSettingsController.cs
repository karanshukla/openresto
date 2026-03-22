using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/email-settings")]
[Authorize]
public class EmailSettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CredentialProtector _protector;
    private readonly IEmailService _emailService;

    public EmailSettingsController(
        AppDbContext db,
        CredentialProtector protector,
        IEmailService emailService)
    {
        _db = db;
        _protector = protector;
        _emailService = emailService;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var settings = await _db.Set<EmailSettings>().FirstOrDefaultAsync();
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
        var settings = await _db.Set<EmailSettings>().FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new EmailSettings();
            _db.Set<EmailSettings>().Add(settings);
        }

        settings.Host = req.Host;
        settings.Port = req.Port;
        settings.Username = req.Username;
        settings.EnableSsl = req.EnableSsl;
        settings.FromName = req.FromName;
        settings.FromEmail = req.FromEmail;

        if (!string.IsNullOrEmpty(req.Password) && req.Password != "••••••••")
        {
            settings.EncryptedPassword = _protector.Encrypt(req.Password);
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Email settings saved." });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test()
    {
        try
        {
            var ok = await _emailService.TestConnectionAsync();
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
