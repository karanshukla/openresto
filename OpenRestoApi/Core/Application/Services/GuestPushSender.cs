using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using WebPush;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Routes a guest reminder by channel: browsers through the same VAPID Web Push client the
/// admin notifications use, the native app through Expo's push service. The Web Push payload
/// carries the same <c>title</c>/<c>body</c> shape as the admin payload so <c>sw.js</c> shows
/// both with one handler; <c>url</c> is what its click opens.
/// </summary>
/// <seealso>GuestPushSenderTests.SendAsync_WebPush_ReportsStaleOnGoneOrNotFound</seealso>
/// <seealso>GuestPushSenderTests.SendAsync_WebPush_ReportsFailureWithoutVapid</seealso>
/// <seealso>GuestPushSenderTests.SendAsync_Expo_DelegatesToTheExpoClient</seealso>
public sealed class GuestPushSender(
    IWebPushClient webPushClient,
    IExpoPushClient expoPushClient,
    IOptions<VapidSettings> vapidOptions) : IGuestPushSender
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly VapidSettings _vapid = vapidOptions.Value;

    public Task<GuestPushResult> SendAsync(GuestPushSubscription subscription, GuestPushMessage message) =>
        subscription.Channel switch
        {
            GuestPushChannels.Expo => expoPushClient.SendAsync(subscription.Endpoint, message),
            GuestPushChannels.WebPush => SendWebPushAsync(subscription, message),
            _ => Task.FromResult(GuestPushResult.Failed($"Unknown channel '{subscription.Channel}'")),
        };

    private async Task<GuestPushResult> SendWebPushAsync(GuestPushSubscription subscription, GuestPushMessage message)
    {
        if (!_vapid.IsConfigured)
        {
            return GuestPushResult.Failed("VAPID is not configured");
        }

        var payload = new
        {
            message.Title,
            message.Body,
            Type = "BookingReminder",
            message.BookingId,
            message.BookingRef,
            message.Url,
        };
        string json = JsonSerializer.Serialize(payload, JsonOptions);
        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);
        var pushSub = new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth);

        try
        {
            await webPushClient.SendNotificationAsync(pushSub, json, vapidDetails);
            return GuestPushResult.Delivered;
        }
        catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
        {
            return GuestPushResult.Stale;
        }
        catch (WebPushException ex)
        {
            return GuestPushResult.Failed($"HTTP {(int)ex.StatusCode}: {ex.Message}");
        }
    }
}
