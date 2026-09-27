using System.Text.RegularExpressions;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// What a push address is allowed to look like before the server will store it and, later,
/// send to it. A Web Push endpoint is a URL the server POSTs to on a timer, so an unchecked one
/// is a request the server makes wherever the subscriber points it — the guest reminder opt-in
/// needs only a booking reference and an email, which anyone can obtain by booking a table.
/// An Expo token is never fetched (it travels in a body to Expo's own API), so it only has to
/// be the shape Expo mints.
/// </summary>
/// <seealso>PushEndpointValidatorTests.IsValidWebPushEndpoint_AcceptsAnHttpsPushService</seealso>
/// <seealso>PushEndpointValidatorTests.IsValidWebPushEndpoint_RejectsPlainHttpPrivateHostsAndNonUrls</seealso>
/// <seealso>PushEndpointValidatorTests.IsValidExpoToken_AcceptsBothTokenPrefixes</seealso>
/// <seealso>PushEndpointValidatorTests.IsValidExpoToken_RejectsAnythingElse</seealso>
public static partial class PushEndpointValidator
{
    [GeneratedRegex(@"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{1,128}\]$")]
    private static partial Regex ExpoToken();

    public static bool IsValidExpoToken(string? token)
        => token is not null && ExpoToken().IsMatch(token);

    public static bool IsValidWebPushEndpoint(string? endpoint)
        => !string.IsNullOrWhiteSpace(endpoint)
            && endpoint.Length <= GuestPushFields.MaxEndpointLength
            && Uri.TryCreate(endpoint, UriKind.Absolute, out Uri? url)
            && url.Scheme == Uri.UriSchemeHttps
            && string.IsNullOrEmpty(url.UserInfo)
            && PublicAddress.IsPublicHost(url);

    /// <summary>The check for whichever channel the subscriber named; an unknown channel is never valid.</summary>
    public static bool IsValidFor(string? channel, string? endpoint)
        => channel switch
        {
            GuestPushChannels.Expo => IsValidExpoToken(endpoint),
            GuestPushChannels.WebPush => IsValidWebPushEndpoint(endpoint),
            _ => false,
        };
}
