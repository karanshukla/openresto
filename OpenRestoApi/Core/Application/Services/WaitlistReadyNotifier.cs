using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IWaitlistReadyNotifier" />
/// <remarks>
/// Email is the only channel today. It is sent whenever outgoing mail is configured, not gated on
/// <c>SendBookingConfirmations</c>: a guest who leaves an address at the door has asked for this
/// one message.
/// </remarks>
public sealed class WaitlistReadyNotifier(
    EmailSettingsService emailSettingsService,
    IEmailService emailService,
    BrandService brandService,
    ILogger<WaitlistReadyNotifier> logger) : IWaitlistReadyNotifier
{
    public async Task NotifyAsync(WaitlistEntry entry, Restaurant restaurant)
    {
        if (string.IsNullOrEmpty(entry.Email))
        {
            return;
        }

        try
        {
            if (await emailSettingsService.GetAsync() is null)
            {
                return;
            }

            BrandSettings brand = await brandService.GetAsync();
            string statusUrl = WaitlistLinks.Status(brandService.GetWebsiteUrl(brand), entry);
            (string subject, string html) = WaitlistReadyCopy.Build(entry.Locale, restaurant.Name, entry.Name, entry.Number, statusUrl);
            string body = await EmailHelper.BuildEmailContentFromBrand(brandService, html);
            await emailService.SendEmailAsync(entry.Email, subject, body);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Waitlist ready email failed for entry {EntryId}", entry.Id);
        }
    }
}
