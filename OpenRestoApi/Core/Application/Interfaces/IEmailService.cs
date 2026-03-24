namespace OpenRestoApi.Core.Application.Interfaces;

public interface IEmailService
{
    Task<bool> TestConnectionAsync();
    Task SendEmailAsync(string recipient, string subject, string htmlBody);
}
