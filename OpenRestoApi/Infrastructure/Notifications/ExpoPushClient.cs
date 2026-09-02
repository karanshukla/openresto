using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using CustomAccessibility.Attributes;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;

namespace OpenRestoApi.Infrastructure.Notifications;

/// <summary>
/// Sends one message through Expo's push API. A <c>DeviceNotRegistered</c> ticket is the Expo
/// equivalent of Web Push's 410: the app was uninstalled or the token rotated, so the caller drops
/// the subscription. Anything else non-ok is a failure the caller logs and keeps.
/// </summary>
/// <seealso>ExpoPushClientTests.SendAsync_ReportsDeliveredOnAnOkTicket</seealso>
/// <seealso>ExpoPushClientTests.SendAsync_ReportsStaleOnDeviceNotRegistered</seealso>
/// <seealso>ExpoPushClientTests.SendAsync_ReportsFailureOnAnErrorTicketOrHttpError</seealso>
/// <seealso>ExpoPushClientTests.SendAsync_SendsTheAccessTokenWhenConfigured</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.ExpoPushClientTests")]
[ExternalAccessAllowed]
internal sealed class ExpoPushClient(IHttpClientFactory httpClientFactory, IOptions<GuestPushSettings> settings) : IExpoPushClient
{
    public const string HttpClientName = "expo-push";
    public static readonly Uri SendEndpoint = new("https://exp.host/--/api/v2/push/send");

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<GuestPushResult> SendAsync(string token, GuestPushMessage message, CancellationToken cancellationToken = default)
    {
        var body = new
        {
            To = token,
            message.Title,
            message.Body,
            Sound = "default",
            Priority = "high",
            ChannelId = "booking-reminders",
            Data = new { message.BookingRef, message.BookingId, message.Url },
        };

        try
        {
            using HttpClient client = httpClientFactory.CreateClient(HttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Post, SendEndpoint)
            {
                Content = JsonContent.Create(body, options: JsonOptions),
            };
            string? accessToken = settings.Value.ExpoAccessToken;
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            }

            using HttpResponseMessage response = await client.SendAsync(request, cancellationToken);
            string raw = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return GuestPushResult.Failed($"HTTP {(int)response.StatusCode}");
            }

            return Interpret(raw);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return GuestPushResult.Failed(ex.GetType().Name);
        }
    }

    /// <summary>Reads the single ticket Expo returns for a single message.</summary>
    private static GuestPushResult Interpret(string raw)
    {
        using JsonDocument doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("data", out JsonElement data))
        {
            return GuestPushResult.Failed("Malformed ticket");
        }

        JsonElement ticket = data.ValueKind == JsonValueKind.Array
            ? (data.GetArrayLength() > 0 ? data[0] : default)
            : data;
        if (ticket.ValueKind != JsonValueKind.Object)
        {
            return GuestPushResult.Failed("Malformed ticket");
        }

        string? status = ticket.TryGetProperty("status", out JsonElement s) ? s.GetString() : null;
        if (status == "ok")
        {
            return GuestPushResult.Delivered;
        }

        string? error = ticket.TryGetProperty("details", out JsonElement details)
            && details.ValueKind == JsonValueKind.Object
            && details.TryGetProperty("error", out JsonElement e)
            ? e.GetString()
            : null;
        if (error == "DeviceNotRegistered")
        {
            return GuestPushResult.Stale;
        }

        string message = ticket.TryGetProperty("message", out JsonElement m) ? m.GetString() ?? "" : "";
        return GuestPushResult.Failed(error is null ? message : $"{error}: {message}");
    }
}
