using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Infrastructure.Email;

public class EmailService : IEmailService
{
    private readonly AppDbContext _db;
    private readonly CredentialProtector _protector;

    public EmailService(AppDbContext db, CredentialProtector protector)
    {
        _db = db;
        _protector = protector;
    }

    private async Task<EmailSettings?> GetSettingsAsync()
    {
        return await _db.Set<EmailSettings>().FirstOrDefaultAsync();
    }

    public async Task<bool> TestConnectionAsync()
    {
        var settings = await GetSettingsAsync();
        if (settings == null)
        {
            return false;
        }

        using var client = new SmtpClient();
        var options = settings.Port == 587
            ? SecureSocketOptions.StartTls
            : settings.EnableSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.None;

        await client.ConnectAsync(settings.Host, settings.Port, options);
        await client.AuthenticateAsync(settings.Username, _protector.Decrypt(settings.EncryptedPassword));
        await client.DisconnectAsync(true);
        return true;
    }

    public async Task SendEmailAsync(string recipient, string subject, string htmlBody)
    {
        var settings = await GetSettingsAsync()
            ?? throw new InvalidOperationException("Email is not configured.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
            settings.FromName ?? "OpenResto",
            settings.FromEmail ?? settings.Username));
        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        var options = settings.Port == 587
            ? SecureSocketOptions.StartTls
            : settings.EnableSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.None;

        await client.ConnectAsync(settings.Host, settings.Port, options);
        await client.AuthenticateAsync(settings.Username, _protector.Decrypt(settings.EncryptedPassword));
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
