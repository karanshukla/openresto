namespace OpenRestoApi.Core.Application.Interfaces;

public interface IEmailService
{
    Task<bool> TestConnectionAsync();
    Task SendEmailAsync(string to, string subject, string htmlBody);
}
