using System.Net;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Infrastructure.NativeClients;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The fetching half of the readiness checks. The URL it is handed was composed from an
/// admin-writable address, so the one thing this pins is that a name resolving inside the
/// deployment is refused before any request is made — and that a public one is fetched and
/// reported as a status and a content type.
/// </summary>
public class WellKnownProbeTests
{
    private sealed class StubHandler(HttpStatusCode status, string contentType, string body) : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            var response = new HttpResponseMessage(status) { Content = new StringContent(body) };
            response.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
            return Task.FromResult(response);
        }
    }

    private sealed class StubFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private static Task<IPAddress[]> ResolvesTo(params string[] addresses)
        => Task.FromResult(addresses.Select(IPAddress.Parse).ToArray());

    [Theory]
    [InlineData("10.0.0.12")]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.169.254")]
    public async Task FetchAsync_RefusesAHostThatResolvesToAPrivateAddress(string resolved)
    {
        var handler = new StubHandler(HttpStatusCode.OK, "application/json", "{}");
        var probe = new WellKnownProbe(new StubFactory(handler), (_, _) => ResolvesTo(resolved));

        WellKnownProbeResult result = await probe.FetchAsync(new Uri("https://bookings.example.com/.well-known/assetlinks.json"));

        Assert.Equal(WellKnownProbe.PrivateAddressError, result.Error);
        Assert.Null(result.StatusCode);
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task FetchAsync_RefusesAHostThatResolvesToAMixOfPublicAndPrivateAddresses()
    {
        var handler = new StubHandler(HttpStatusCode.OK, "application/json", "{}");
        var probe = new WellKnownProbe(new StubFactory(handler), (_, _) => ResolvesTo("203.0.113.9", "10.0.0.12"));

        WellKnownProbeResult result = await probe.FetchAsync(new Uri("https://bookings.example.com/.well-known/assetlinks.json"));

        Assert.Equal(WellKnownProbe.PrivateAddressError, result.Error);
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task FetchAsync_RefusesAPrivateLiteralWithoutResolving()
    {
        var handler = new StubHandler(HttpStatusCode.OK, "application/json", "{}");
        bool resolved = false;
        var probe = new WellKnownProbe(new StubFactory(handler), (_, _) => { resolved = true; return ResolvesTo("8.8.8.8"); });

        WellKnownProbeResult result = await probe.FetchAsync(new Uri("https://192.168.1.10/.well-known/assetlinks.json"));

        Assert.Equal(WellKnownProbe.PrivateAddressError, result.Error);
        Assert.False(resolved);
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task FetchAsync_ReportsTheStatusAndContentTypeOfAPublicHost()
    {
        var handler = new StubHandler(HttpStatusCode.OK, "application/json", """{"applinks":{}}""");
        var probe = new WellKnownProbe(new StubFactory(handler), (_, _) => ResolvesTo("203.0.113.9"));

        WellKnownProbeResult result = await probe.FetchAsync(new Uri("https://bookings.example.com/.well-known/apple-app-site-association"));

        Assert.Null(result.Error);
        Assert.Equal(200, result.StatusCode);
        Assert.Equal("application/json", result.ContentType);
        Assert.Equal("""{"applinks":{}}""", result.Body);
        Assert.Equal(1, handler.Requests);
    }

    [Fact]
    public async Task FetchAsync_ReportsAFailedLookupByTypeNotMessage()
    {
        var handler = new StubHandler(HttpStatusCode.OK, "application/json", "{}");
        var probe = new WellKnownProbe(
            new StubFactory(handler),
            (_, _) => throw new System.Net.Sockets.SocketException((int)System.Net.Sockets.SocketError.HostNotFound));

        WellKnownProbeResult result = await probe.FetchAsync(new Uri("https://nowhere.example.com/.well-known/assetlinks.json"));

        Assert.Equal("SocketException", result.Error);
        Assert.Equal(0, handler.Requests);
    }

    /// <summary>
    /// The resolver is an optional constructor parameter so tests can stub DNS; the container
    /// has nothing registered for it and must fall back to the default rather than refuse to
    /// build the probe — which nothing else would catch until the status endpoint was hit.
    /// </summary>
    [Fact]
    public void ResolvesFromTheContainerWithTheDefaultResolver()
    {
        var services = new ServiceCollection();
        services.AddHttpClient(WellKnownProbe.HttpClientName);
        services.AddScoped<IWellKnownProbe, WellKnownProbe>();
        using ServiceProvider provider = services.BuildServiceProvider();
        using IServiceScope scope = provider.CreateScope();

        Assert.IsType<WellKnownProbe>(scope.ServiceProvider.GetRequiredService<IWellKnownProbe>());
    }
}
