using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// A push address is a place the server will later send to, so the accepted shapes are pinned
/// on both sides: a real push service passes, and anything that would turn the reminder worker
/// into a request to a host of the subscriber's choosing does not.
/// </summary>
public class PushEndpointValidatorTests
{
    [Theory]
    [InlineData("https://fcm.googleapis.com/fcm/send/abc123:APA91b")]
    [InlineData("https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk")]
    [InlineData("https://web.push.apple.com/QGZ2b")]
    public void IsValidWebPushEndpoint_AcceptsAnHttpsPushService(string endpoint)
        => Assert.True(PushEndpointValidator.IsValidWebPushEndpoint(endpoint));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("http://fcm.googleapis.com/fcm/send/abc")]
    [InlineData("ftp://push.example.com/")]
    [InlineData("https://localhost:8080/push")]
    [InlineData("https://127.0.0.1/push")]
    [InlineData("https://10.0.0.7/push")]
    [InlineData("https://169.254.169.254/latest/meta-data")]
    [InlineData("https://backend.internal/push")]
    [InlineData("https://user:secret@push.example.com/")]
    public void IsValidWebPushEndpoint_RejectsPlainHttpPrivateHostsAndNonUrls(string? endpoint)
        => Assert.False(PushEndpointValidator.IsValidWebPushEndpoint(endpoint));

    [Fact]
    public void IsValidWebPushEndpoint_RejectsAnEndpointLongerThanTheColumn()
        => Assert.False(PushEndpointValidator.IsValidWebPushEndpoint(
            "https://push.example.com/" + new string('a', GuestPushFields.MaxEndpointLength)));

    [Theory]
    [InlineData("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")]
    [InlineData("ExpoPushToken[abc-DEF_123]")]
    public void IsValidExpoToken_AcceptsBothTokenPrefixes(string token)
        => Assert.True(PushEndpointValidator.IsValidExpoToken(token));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ExponentPushToken[]")]
    [InlineData("ExponentPushToken[abc")]
    [InlineData("exponentpushtoken[abc]")]
    [InlineData("https://exp.host/--/api/v2/push/send")]
    [InlineData("ExponentPushToken[abc]; DROP TABLE")]
    public void IsValidExpoToken_RejectsAnythingElse(string? token)
        => Assert.False(PushEndpointValidator.IsValidExpoToken(token));

    [Fact]
    public void IsValidFor_HoldsEachChannelToItsOwnShape()
    {
        Assert.True(PushEndpointValidator.IsValidFor(GuestPushChannels.Expo, "ExponentPushToken[abc]"));
        Assert.False(PushEndpointValidator.IsValidFor(GuestPushChannels.Expo, "https://fcm.googleapis.com/x"));
        Assert.True(PushEndpointValidator.IsValidFor(GuestPushChannels.WebPush, "https://fcm.googleapis.com/x"));
        Assert.False(PushEndpointValidator.IsValidFor(GuestPushChannels.WebPush, "ExponentPushToken[abc]"));
        Assert.False(PushEndpointValidator.IsValidFor("sms", "+15550100"));
    }
}
