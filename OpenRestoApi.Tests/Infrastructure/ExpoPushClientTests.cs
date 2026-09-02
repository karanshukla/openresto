using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Infrastructure.Notifications;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The Expo push API contract as this server relies on it: one message per request to the
/// send endpoint, one ticket back (as an object or a one-element array), <c>DeviceNotRegistered</c>
/// meaning the address is gone, and the optional access token as a bearer header.
/// </summary>
public class ExpoPushClientTests
{
    private const string Token = "ExponentPushToken[abc]";

    private static readonly GuestPushMessage Message = new(
        Title: "Your table at Bistro",
        Body: "Tomorrow at 19:30 · 2 guests · Ref crispy-basil-truffle",
        BookingRef: "crispy-basil-truffle",
        BookingId: 7,
        Url: "https://bookings.example.com/booking-confirmation/crispy-basil-truffle?email=guest%40example.com");

    private const string OkTicket = """{"data":{"status":"ok","id":"XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"}}""";

    private sealed class RecordingHandler(HttpStatusCode status, string responseBody) : HttpMessageHandler
    {
        public HttpMethod? Method { get; private set; }
        public Uri? RequestUri { get; private set; }
        public string? RequestBody { get; private set; }
        public AuthenticationHeaderValue? Authorization { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Method = request.Method;
            RequestUri = request.RequestUri;
            Authorization = request.Headers.Authorization;
            RequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed class ThrowingHandler(Exception exception) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw exception;
    }

    private static ExpoPushClient CreateClient(HttpMessageHandler handler, GuestPushSettings? settings = null)
    {
        var factory = new Mock<IHttpClientFactory>();
        factory
            .Setup(f => f.CreateClient(ExpoPushClient.HttpClientName))
            .Returns(() => new HttpClient(handler, disposeHandler: false));
        return new ExpoPushClient(factory.Object, Options.Create(settings ?? new GuestPushSettings()));
    }

    [Fact]
    public async Task SendAsync_ReportsDeliveredOnAnOkTicket()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, OkTicket);

        GuestPushResult result = await CreateClient(handler).SendAsync(Token, Message);

        Assert.Equal(GuestPushOutcome.Delivered, result.Outcome);
        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal(ExpoPushClient.SendEndpoint, handler.RequestUri);
        Assert.Null(handler.Authorization);

        using JsonDocument doc = JsonDocument.Parse(handler.RequestBody!);
        JsonElement root = doc.RootElement;
        Assert.Equal(Token, root.GetProperty("to").GetString());
        Assert.Equal(Message.Title, root.GetProperty("title").GetString());
        Assert.Equal(Message.Body, root.GetProperty("body").GetString());
        JsonElement data = root.GetProperty("data");
        Assert.Equal(Message.BookingRef, data.GetProperty("bookingRef").GetString());
        Assert.Equal(Message.BookingId, data.GetProperty("bookingId").GetInt32());
        Assert.Equal(Message.Url, data.GetProperty("url").GetString());
    }

    [Theory]
    [InlineData("""{"data":[{"status":"error","message":"\"ExponentPushToken[abc]\" is not a registered push notification recipient","details":{"error":"DeviceNotRegistered"}}]}""")]
    [InlineData("""{"data":{"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}}}""")]
    public async Task SendAsync_ReportsStaleOnDeviceNotRegistered(string ticket)
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, ticket);

        GuestPushResult result = await CreateClient(handler).SendAsync(Token, Message);

        Assert.Equal(GuestPushOutcome.Stale, result.Outcome);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK, """{"data":{"status":"error","message":"too big","details":{"error":"MessageTooBig"}}}""", "MessageTooBig: too big")]
    [InlineData(HttpStatusCode.OK, """{"data":[{"status":"error","message":"rate limited"}]}""", "rate limited")]
    [InlineData(HttpStatusCode.OK, """{"data":[]}""", "Malformed ticket")]
    [InlineData(HttpStatusCode.OK, """{"errors":[{"code":"PUSH_TOO_MANY_EXPERIENCE_IDS"}]}""", "Malformed ticket")]
    [InlineData(HttpStatusCode.InternalServerError, "", "HTTP 500")]
    [InlineData(HttpStatusCode.Unauthorized, """{"errors":[{"code":"UNAUTHORIZED"}]}""", "HTTP 401")]
    public async Task SendAsync_ReportsFailureOnAnErrorTicketOrHttpError(HttpStatusCode status, string body, string expectedError)
    {
        var handler = new RecordingHandler(status, body);

        GuestPushResult result = await CreateClient(handler).SendAsync(Token, Message);

        Assert.Equal(GuestPushOutcome.Failed, result.Outcome);
        Assert.Equal(expectedError, result.Error);
    }

    [Fact]
    public async Task SendAsync_ReportsFailureWhenTheTransportThrows_RatherThanPropagating()
    {
        GuestPushResult unreachable = await CreateClient(new ThrowingHandler(new HttpRequestException("no route")))
            .SendAsync(Token, Message);
        GuestPushResult timedOut = await CreateClient(new ThrowingHandler(new TaskCanceledException("timeout")))
            .SendAsync(Token, Message);
        GuestPushResult notJson = await CreateClient(new RecordingHandler(HttpStatusCode.OK, "<html>"))
            .SendAsync(Token, Message);

        Assert.Equal(GuestPushOutcome.Failed, unreachable.Outcome);
        Assert.Equal(nameof(HttpRequestException), unreachable.Error);
        Assert.Equal(GuestPushOutcome.Failed, timedOut.Outcome);
        Assert.Equal(nameof(TaskCanceledException), timedOut.Error);
        Assert.Equal(GuestPushOutcome.Failed, notJson.Outcome);
        Assert.Contains("Json", notJson.Error);
        Assert.EndsWith("Exception", notJson.Error);
    }

    [Fact]
    public async Task SendAsync_SendsTheAccessTokenWhenConfigured()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, OkTicket);

        await CreateClient(handler, new GuestPushSettings { ExpoAccessToken = "expo-secret" }).SendAsync(Token, Message);

        Assert.NotNull(handler.Authorization);
        Assert.Equal("Bearer", handler.Authorization.Scheme);
        Assert.Equal("expo-secret", handler.Authorization.Parameter);
    }

    [Fact]
    public async Task SendAsync_SendsNoAuthorizationForABlankAccessToken()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, OkTicket);

        await CreateClient(handler, new GuestPushSettings { ExpoAccessToken = "   " }).SendAsync(Token, Message);

        Assert.Null(handler.Authorization);
    }
}
