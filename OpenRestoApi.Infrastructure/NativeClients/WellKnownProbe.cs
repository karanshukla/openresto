using System.Net;
using System.Net.Sockets;
using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Infrastructure.NativeClients;

/// <summary>
/// Fetches one of the deployment's own <c>/.well-known/</c> documents so the admin sees what a
/// store's verifier would see. The URL is always built by
/// <c>NativeAppStatusService</c> from the admin-configured public address — never from anything
/// on the request — because a probe that fetched a caller-supplied URL would be an SSRF
/// primitive reachable with a read-only API key. That address is itself writable by anyone
/// with <c>brand:write</c>, so the URL is composed by <c>NativeAppChecks.TryBuildWellKnownUrl</c>
/// rather than concatenated, the host is resolved here and refused when it lands on a private
/// network, redirects are never followed, and the body is capped: what comes back is a status,
/// a content type and a JSON shape, and it never came from inside the deployment.
/// </summary>
/// <seealso>WellKnownProbeTests.FetchAsync_RefusesAHostThatResolvesToAPrivateAddress</seealso>
/// <seealso>WellKnownProbeTests.FetchAsync_ReportsTheStatusAndContentTypeOfAPublicHost</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.WellKnownProbeTests")]
[ExternalAccessAllowed]
internal sealed class WellKnownProbe(
    IHttpClientFactory httpClientFactory,
    Func<string, CancellationToken, Task<IPAddress[]>>? resolve = null) : IWellKnownProbe
{
    /// <summary>Named client, configured with the timeout, redirect and size limits in <c>ServiceCollectionExtensions</c>.</summary>
    public const string HttpClientName = "well-known";

    /// <summary>The largest body worth reading; both verification files are a few hundred bytes.</summary>
    public const long MaxBodyBytes = 64 * 1024;

    public const string PrivateAddressError = "the address resolves to a private network";

    private readonly Func<string, CancellationToken, Task<IPAddress[]>> _resolve =
        resolve ?? Dns.GetHostAddressesAsync;

    public async Task<WellKnownProbeResult> FetchAsync(Uri url, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!PublicAddress.IsPublicHost(url))
            {
                return WellKnownProbeResult.Unreachable(PrivateAddressError);
            }

            if (url.HostNameType == UriHostNameType.Dns)
            {
                IPAddress[] addresses = await _resolve(url.Host, cancellationToken);
                if (addresses.Length == 0 || addresses.Any(address => !PublicAddress.IsPublic(address)))
                {
                    return WellKnownProbeResult.Unreachable(PrivateAddressError);
                }
            }

            using HttpClient client = httpClientFactory.CreateClient(HttpClientName);
            using HttpResponseMessage response = await client.GetAsync(url, cancellationToken);
            string body = await response.Content.ReadAsStringAsync(cancellationToken);
            return new WellKnownProbeResult(
                (int)response.StatusCode,
                response.Content.Headers.ContentType?.MediaType,
                body,
                Error: null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException or SocketException)
        {
            // The exception type, not its message: a DNS or TLS message can carry the whole
            // request URL back into the admin screen, and the type is what the reader acts on.
            return WellKnownProbeResult.Unreachable(ex.GetType().Name);
        }
    }
}
