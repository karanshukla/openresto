using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class EmailSettingsService(AppDbContext db, CredentialProtector protector, IEmailService emailService)
{
    private readonly AppDbContext _db = db;
    private readonly CredentialProtector _protector = protector;
    private readonly IEmailService _emailService = emailService;

    public async Task<EmailSettings?> GetAsync()
    {
        return await _db.Set<EmailSettings>().FirstOrDefaultAsync();
    }

    public async Task SaveAsync(
        string host, int port, string username, string? password,
        bool enableSsl, string? fromName, string? fromEmail)
    {
        EmailSettings? settings = await _db.Set<EmailSettings>().FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new EmailSettings();
            _db.Set<EmailSettings>().Add(settings);
        }

        settings.Host = host;
        settings.Port = port;
        settings.Username = username;
        settings.EnableSsl = enableSsl;
        settings.FromName = fromName;
        settings.FromEmail = fromEmail;

        if (!string.IsNullOrEmpty(password) && password != "••••••••")
        {
            settings.EncryptedPassword = _protector.Encrypt(password);
        }

        await _db.SaveChangesAsync();
    }

    public async Task<bool> TestConnectionAsync()
    {
        return await _emailService.TestConnectionAsync();
    }
}
