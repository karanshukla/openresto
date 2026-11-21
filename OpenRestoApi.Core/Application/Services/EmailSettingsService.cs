using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class EmailSettingsService(
    IEmailSettingsRepository settingsRepository,
    IEmailFailureRepository emailFailureRepository,
    ICredentialProtector protector,
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
        ICredentialProtector credentialProtector,
        IEmailService email)
        : this(settings, failures, credentialProtector, email, null) { }

    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;
    private readonly IEmailSettingsRepository _settingsRepository = settingsRepository;
    private readonly IEmailFailureRepository _emailFailureRepository = emailFailureRepository;
    private readonly ICredentialProtector _protector = protector;
    private readonly IEmailService _emailService = emailService;

    public virtual async Task<EmailSettings?> GetAsync()
    {
        return await _settingsRepository.GetAsync();
    }

    /// <summary>
    /// The stored password is sent to whatever server the record names, so pointing the record at
    /// a new server, or dropping SSL, while keeping it would hand the password to a relay of the
    /// editor's choosing. Changing any of those takes the password typed again.
    /// </summary>
    /// <seealso>EmailSettingsServiceTests.SaveAsync_RefusesANewHost_WithoutThePasswordTypedAgain</seealso>
    /// <seealso>EmailSettingsServiceTests.SaveAsync_AcceptsANewHost_WithThePasswordTypedAgain</seealso>
    /// <seealso>EmailSettingsServiceTests.SaveAsync_SkipsEncryption_WhenPasswordIsMask</seealso>
    private static bool WouldSendStoredPasswordElsewhere(EmailSettings stored, string host, int port, string username, bool enableSsl)
        => !string.IsNullOrEmpty(stored.EncryptedPassword)
            && (!string.Equals(stored.Host, host, StringComparison.OrdinalIgnoreCase)
                || stored.Port != port
                || !string.Equals(stored.Username, username, StringComparison.Ordinal)
                || (stored.EnableSsl && !enableSsl));

    public virtual async Task SaveAsync(
        string host, int port, string username, string? password,
        bool enableSsl, string? fromName, string? fromEmail,
        bool sendBookingConfirmations = false,
        bool sendRestaurantBookingAlerts = false)
    {
        EmailSettings? settings = await _settingsRepository.GetAsync();
        bool isNew = false;
        if (settings == null)
        {
            settings = new EmailSettings();
            isNew = true;
        }

        bool hasNewPassword = !string.IsNullOrEmpty(password) && password != "••••••••";
        if (!hasNewPassword && WouldSendStoredPasswordElsewhere(settings, host, port, username, enableSsl))
        {
            throw new ValidationException("Re-enter the SMTP password to change the host, port or username, or to turn off SSL.")
            { Code = ErrorCodes.EmailPasswordRequired };
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
        _audit.RecordChange("sendRestaurantBookingAlerts", settings.SendRestaurantBookingAlerts, sendRestaurantBookingAlerts);

        settings.Host = host;
        settings.Port = port;
        settings.Username = username;
        settings.EnableSsl = enableSsl;
        settings.FromName = fromName;
        settings.FromEmail = fromEmail;
        settings.SendBookingConfirmations = sendBookingConfirmations;
        settings.SendRestaurantBookingAlerts = sendRestaurantBookingAlerts;

        if (hasNewPassword)
        {
            string? previous = settings.EncryptedPassword;
            settings.EncryptedPassword = _protector.Encrypt(password!);
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
