using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using WebPush;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// The channel switch in front of the two push transports: a Web Push address that answers
/// 410/404 is reported stale so the caller drops it, any other refusal is a failure the caller
/// keeps, an unconfigured VAPID pair fails before anything is sent, and the Expo channel is
/// handed straight to the Expo client.
/// </summary>
public class GuestPushSenderTests
{
    private const string Endpoint = "https://push.example/sub1";
    private const string ExpoToken = "ExponentPushToken[abc]";

    private static readonly GuestPushMessage Message = new(
        Title: "Your table at Bistro",
        Body: "Tomorrow at 19:30 · 2 guests · Ref crispy-basil-truffle",
        BookingRef: "crispy-basil-truffle",
        BookingId: 7,
        Url: "https://bookings.example.com/booking-confirmation/crispy-basil-truffle?email=guest%40example.com");

    private readonly Mock<IWebPushClient> _webPush = new();
    private readonly Mock<IExpoPushClient> _expo = new();

    private static VapidSettings ConfiguredVapid() => new()
    {
        Subject = "mailto:ops@openresto.com",
        PublicKey = "BPUBLICKEY",
        PrivateKey = "PRIVATEKEY",
    };

    private GuestPushSender CreateSender(VapidSettings? vapid = null) =>
        new(_webPush.Object, _expo.Object, Options.Create(vapid ?? new VapidSettings()));

    private static GuestPushSubscription WebPushSubscription() => new()
    {
        Channel = GuestPushChannels.WebPush,
        Endpoint = Endpoint,
        P256dh = "p256dh-key",
        Auth = "auth-secret",
    };

    private static WebPushException MakeWebPushException(HttpStatusCode statusCode) =>
        new("push failed", new PushSubscription(Endpoint, "p256dh-key", "auth-secret"), new HttpResponseMessage(statusCode));

    private void WebPushThrows(HttpStatusCode statusCode) =>
        _webPush
            .Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(MakeWebPushException(statusCode));

    [Theory]
    [InlineData(HttpStatusCode.Gone)]
    [InlineData(HttpStatusCode.NotFound)]
    public async Task SendAsync_WebPush_ReportsStaleOnGoneOrNotFound(HttpStatusCode statusCode)
    {
        WebPushThrows(statusCode);

        GuestPushResult result = await CreateSender(ConfiguredVapid()).SendAsync(WebPushSubscription(), Message);

        Assert.Equal(GuestPushOutcome.Stale, result.Outcome);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task SendAsync_WebPush_ReportsFailureOnAnyOtherRefusal_WithTheStatus(HttpStatusCode statusCode)
    {
        WebPushThrows(statusCode);

        GuestPushResult result = await CreateSender(ConfiguredVapid()).SendAsync(WebPushSubscription(), Message);

        Assert.Equal(GuestPushOutcome.Failed, result.Outcome);
        Assert.StartsWith($"HTTP {(int)statusCode}:", result.Error);
    }

    [Fact]
    public async Task SendAsync_WebPush_ReportsFailureWithoutVapid()
    {
        GuestPushResult result = await CreateSender().SendAsync(WebPushSubscription(), Message);

        Assert.Equal(GuestPushOutcome.Failed, result.Outcome);
        Assert.Equal("VAPID is not configured", result.Error);
        _webPush.Verify(
            c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    /// <summary>
    /// The same camelCase <c>title</c>/<c>body</c> shape as the admin payload, so the one
    /// handler in <c>sw.js</c> shows both; <c>url</c> is what a click on it opens.
    /// </summary>
    [Fact]
    public async Task SendAsync_WebPush_SendsACamelCaseJsonPayloadToTheSubscription()
    {
        PushSubscription? sentTo = null;
        string? payload = null;
        VapidDetails? vapid = null;
        _webPush
            .Setup(c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>(), It.IsAny<CancellationToken>()))
            .Callback<PushSubscription, string, VapidDetails, CancellationToken>((sub, json, details, _) =>
            {
                sentTo = sub;
                payload = json;
                vapid = details;
            })
            .Returns(Task.CompletedTask);

        GuestPushResult result = await CreateSender(ConfiguredVapid()).SendAsync(WebPushSubscription(), Message);

        Assert.Equal(GuestPushOutcome.Delivered, result.Outcome);
        Assert.NotNull(sentTo);
        Assert.Equal(Endpoint, sentTo.Endpoint);
        Assert.Equal("p256dh-key", sentTo.P256DH);
        Assert.Equal("auth-secret", sentTo.Auth);
        Assert.NotNull(vapid);
        Assert.Equal("mailto:ops@openresto.com", vapid.Subject);
        Assert.Equal("BPUBLICKEY", vapid.PublicKey);

        using JsonDocument doc = JsonDocument.Parse(payload!);
        JsonElement root = doc.RootElement;
        Assert.Equal(Message.Title, root.GetProperty("title").GetString());
        Assert.Equal(Message.Body, root.GetProperty("body").GetString());
        Assert.Equal(Message.Url, root.GetProperty("url").GetString());
        Assert.Equal(Message.BookingRef, root.GetProperty("bookingRef").GetString());
        Assert.Equal(Message.BookingId, root.GetProperty("bookingId").GetInt32());
        Assert.Equal("BookingReminder", root.GetProperty("type").GetString());
        Assert.False(root.TryGetProperty("Title", out _), "Payload keys must be camelCase, as sw.js reads them.");
    }

    [Fact]
    public async Task SendAsync_Expo_DelegatesToTheExpoClient()
    {
        _expo
            .Setup(e => e.SendAsync(ExpoToken, Message, It.IsAny<CancellationToken>()))
            .ReturnsAsync(GuestPushResult.Stale);
        var subscription = new GuestPushSubscription { Channel = GuestPushChannels.Expo, Endpoint = ExpoToken };

        GuestPushResult result = await CreateSender().SendAsync(subscription, Message);

        Assert.Equal(GuestPushOutcome.Stale, result.Outcome);
        _expo.Verify(e => e.SendAsync(ExpoToken, Message, It.IsAny<CancellationToken>()), Times.Once);
        _webPush.Verify(
            c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SendAsync_ReportsFailureForAnUnknownChannel()
    {
        var subscription = new GuestPushSubscription { Channel = "sms", Endpoint = "+15550100" };

        GuestPushResult result = await CreateSender(ConfiguredVapid()).SendAsync(subscription, Message);

        Assert.Equal(GuestPushOutcome.Failed, result.Outcome);
        Assert.Contains("sms", result.Error);
        _expo.Verify(e => e.SendAsync(It.IsAny<string>(), It.IsAny<GuestPushMessage>(), It.IsAny<CancellationToken>()), Times.Never);
        _webPush.Verify(
            c => c.SendNotificationAsync(It.IsAny<PushSubscription>(), It.IsAny<string>(), It.IsAny<VapidDetails>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
