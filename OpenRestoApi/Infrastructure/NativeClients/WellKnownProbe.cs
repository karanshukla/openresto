using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.NativeClients;

/// <summary>
/// Fetches one of the deployment's own <c>/.well-known/</c> documents so the admin sees what a
/// store's verifier would see. The URL is always built by
/// <c>NativeAppStatusService</c> from the admin-configured public address — never from anything
/// on the request — because a probe that fetched a caller-supplied URL would be an SSRF
/// primitive reachable with a read-only API key.
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[ExternalAccessAllowed]
internal sealed class WellKnownProbe(IHttpClientFactory httpClientFactory) : IWellKnownProbe
{
    /// <summary>Named client, configured with the timeout in <c>ServiceCollectionExtensions</c>.</summary>
    public const string HttpClientName = "well-known";

    public async Task<WellKnownProbeResult> FetchAsync(Uri url, CancellationToken cancellationToken = default)
    {
        try
        {
            using HttpClient client = httpClientFactory.CreateClient(HttpClientName);
            using HttpResponseMessage response = await client.GetAsync(url, cancellationToken);
            string body = await response.Content.ReadAsStringAsync(cancellationToken);
            return new WellKnownProbeResult(
                (int)response.StatusCode,
                response.Content.Headers.ContentType?.MediaType,
                body,
                Error: null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            // The exception type, not its message: a DNS or TLS message can carry the whole
            // request URL back into the admin screen, and the type is what the reader acts on.
            return WellKnownProbeResult.Unreachable(ex.GetType().Name);
        }
    }
}
