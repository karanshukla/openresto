using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;

namespace OpenRestoApi.Core.Application.Services;

public class EmailSettingsService(
    IEmailSettingsRepository settingsRepository,
    IEmailFailureRepository emailFailureRepository,
    CredentialProtector protector,
    IEmailService emailService,
    IAuditScope? audit = null)
{
    /// <summary>
    /// Castle's generated proxy constructors drop default values, so a Moq class mock reaches only
    /// a constructor of exactly matching arity. This is that constructor.
    /// </summary>
    public EmailSettingsService(
        IEmailSettingsRepository settings,
        IEmailFailureRepository failures,
        CredentialProtector credentialProtector,
        IEmailService email)
        : this(settings, failures, credentialProtector, email, null) { }

    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;
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

        // Named one by one rather than serialized from the request: the request also carries the
        // SMTP password, and an audit entry may never hold a credential.
        _audit.RecordChange("host", settings.Host, host);
        _audit.RecordChange("port", settings.Port, port);
        _audit.RecordChange("username", settings.Username, username);
        _audit.RecordChange("enableSsl", settings.EnableSsl, enableSsl);
        _audit.RecordChange("fromName", settings.FromName, fromName);
        _audit.RecordChange("fromEmail", settings.FromEmail, fromEmail);
        _audit.RecordChange("sendBookingConfirmations", settings.SendBookingConfirmations, sendBookingConfirmations);

        settings.Host = host;
        settings.Port = port;
        settings.Username = username;
        settings.EnableSsl = enableSsl;
        settings.FromName = fromName;
        settings.FromEmail = fromEmail;
        settings.SendBookingConfirmations = sendBookingConfirmations;

        if (!string.IsNullOrEmpty(password) && password != "••••••••")
        {
            string? previous = settings.EncryptedPassword;
            settings.EncryptedPassword = _protector.Encrypt(password);
            // Both sides mask to the redaction marker, so the entry carries the fact of the
            // change and nothing more.
            _audit.RecordChange("password", previous, settings.EncryptedPassword);
        }

        if (isNew)
        {
            await _settingsRepository.AddAsync(settings);
        }
        else
        {
            await _settingsRepository.SaveChangesAsync();
        }

        _audit.Describe(AuditActions.EmailSettingsUpdate, AuditTargets.EmailSettings,
            summary: $"Updated the outgoing email settings ({host}:{port})");
    }

    public virtual async Task<bool> TestConnectionAsync()
    {
        bool connected = await _emailService.TestConnectionAsync();
        _audit.Describe(AuditActions.EmailSettingsTest, AuditTargets.EmailSettings,
            summary: connected
                ? "Tested the outgoing email connection — succeeded"
                : "Tested the outgoing email connection — failed");
        return connected;
    }

    public virtual async Task<IReadOnlyList<EmailFailure>> GetFailuresAsync()
    {
        return await _emailFailureRepository.GetRecentAsync(50);
    }
}
