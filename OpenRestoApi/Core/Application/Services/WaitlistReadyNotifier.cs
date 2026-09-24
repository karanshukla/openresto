using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IWaitlistReadyNotifier" />
/// <remarks>
/// Two channels, each independent of the other: an email when the guest left an address, and a
/// push when a device asked for one from the ticket. The email is sent whenever outgoing mail is
/// configured, not gated on <c>SendBookingConfirmations</c>: a guest who leaves an address at the
/// door has asked for this one message. A push address that no longer exists is cleared from the
/// entry; the caller saves it.
/// </remarks>
/// <seealso>WaitlistReadyNotifierTests.NotifyAsync_PushesToTheTicketsDevice</seealso>
/// <seealso>WaitlistReadyNotifierTests.NotifyAsync_ClearsAStaleDevice</seealso>
/// <seealso>WaitlistReadyNotifierTests.NotifyAsync_SendsNothingWithoutEmailOrDevice</seealso>
public sealed class WaitlistReadyNotifier(
    EmailSettingsService emailSettingsService,
    IEmailService emailService,
    IGuestPushSender pushSender,
    BrandService brandService,
    ILogger<WaitlistReadyNotifier> logger) : IWaitlistReadyNotifier
{
    public async Task NotifyAsync(WaitlistEntry entry, Restaurant restaurant)
    {
        GuestPushAddress? device = entry.PushAddress();
        if (string.IsNullOrEmpty(entry.Email) && device is null)
        {
            return;
        }

        string statusUrl;
        try
        {
            BrandSettings brand = await brandService.GetAsync();
            statusUrl = WaitlistLinks.Status(brandService.GetWebsiteUrl(brand), entry);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Waitlist ready notice failed for entry {EntryId}", entry.Id);
            return;
        }

        if (device is not null)
        {
            await PushAsync(entry, restaurant, device, statusUrl);
        }

        if (!string.IsNullOrEmpty(entry.Email))
        {
            await EmailAsync(entry, restaurant, entry.Email, statusUrl);
        }
    }

    private async Task PushAsync(WaitlistEntry entry, Restaurant restaurant, GuestPushAddress device, string statusUrl)
    {
        (string title, string body) = WaitlistReadyCopy.BuildPush(entry.Locale, restaurant.Name, entry.Number);
        try
        {
            GuestPushResult result = await pushSender.SendAsync(device, new GuestPushMessage(title, body, statusUrl, $"waitlist-{entry.Id}"));
            if (result.Outcome == GuestPushOutcome.Stale)
            {
                entry.ClearPush();
            }
            else if (result.Outcome == GuestPushOutcome.Failed)
            {
                logger.LogWarning("Waitlist ready push failed for entry {EntryId}: {Error}", entry.Id, result.Error);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Waitlist ready push failed for entry {EntryId}", entry.Id);
        }
    }

    private async Task EmailAsync(WaitlistEntry entry, Restaurant restaurant, string email, string statusUrl)
    {
        try
        {
            if (await emailSettingsService.GetAsync() is null)
            {
                return;
            }

            (string subject, string html) = WaitlistReadyCopy.Build(entry.Locale, restaurant.Name, entry.Name, entry.Number, statusUrl);
            string body = await EmailHelper.BuildEmailContentFromBrand(brandService, html);
            await emailService.SendEmailAsync(email, subject, body);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Waitlist ready email failed for entry {EntryId}", entry.Id);
        }
    }
}
