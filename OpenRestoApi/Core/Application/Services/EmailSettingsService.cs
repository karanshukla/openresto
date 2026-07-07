using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;

namespace OpenRestoApi.Core.Application.Services;

public class EmailSettingsService(
    IEmailSettingsRepository settingsRepository,
    IEmailFailureRepository emailFailureRepository,
    CredentialProtector protector,
    IEmailService emailService)
{
    private readonly IEmailSettingsRepository _settingsRepository = settingsRepository;
    private readonly IEmailFailureRepository _emailFailureRepository = emailFailureRepository;
    private readonly CredentialProtector _protector = protector;
    private readonly IEmailService _emailService = emailService;

    public virtual async Task<EmailSettings?> GetAsync()
    {
        return await _settingsRepository.GetAsync();
    }

    public virtual async Task SaveAsync(
        string host, int port, string username, string? password,
        bool enableSsl, string? fromName, string? fromEmail,
        bool sendBookingConfirmations = false)
    {
        EmailSettings? settings = await _settingsRepository.GetAsync();
        bool isNew = false;
        if (settings == null)
        {
            settings = new EmailSettings();
            isNew = true;
        }

        settings.Host = host;
        settings.Port = port;
        settings.Username = username;
        settings.EnableSsl = enableSsl;
        settings.FromName = fromName;
        settings.FromEmail = fromEmail;
        settings.SendBookingConfirmations = sendBookingConfirmations;

        if (!string.IsNullOrEmpty(password) && password != "••••••••")
        {
            settings.EncryptedPassword = _protector.Encrypt(password);
        }

        if (isNew)
        {
            await _settingsRepository.AddAsync(settings);
        }
        else
        {
            await _settingsRepository.SaveChangesAsync();
        }
    }

    public virtual async Task<bool> TestConnectionAsync()
    {
        return await _emailService.TestConnectionAsync();
    }

    public virtual async Task<IReadOnlyList<EmailFailure>> GetFailuresAsync()
    {
        return await _emailFailureRepository.GetRecentAsync(50);
    }
}
