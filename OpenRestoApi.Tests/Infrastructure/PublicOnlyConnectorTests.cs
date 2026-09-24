using System.Net;
using OpenRestoApi.Infrastructure.Notifications;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The Web Push client's connect step. A push endpoint's host comes from whoever subscribed, so
/// what this pins is that a name resolving inside the deployment — wholly or in part — and a
/// private address written into the URL are both refused before a socket is opened.
/// </summary>
public class PublicOnlyConnectorTests
{
    private static Task<IPAddress[]> ResolvesTo(params string[] addresses)
        => Task.FromResult(addresses.Select(IPAddress.Parse).ToArray());

    private static async Task<HttpRequestException> SendThrough(PublicOnlyConnector connector, string url)
    {
        using var client = new HttpClient(connector.CreateHandler());
        return await Assert.ThrowsAsync<HttpRequestException>(() => client.PostAsync(url, new StringContent("")));
    }

    [Theory]
    [InlineData("10.0.0.12")]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.169.254")]
    [InlineData("::1")]
    public async Task Send_RefusesAHostThatResolvesToAPrivateAddress(string resolved)
    {
        var connector = new PublicOnlyConnector((_, _) => ResolvesTo(resolved));

        HttpRequestException ex = await SendThrough(connector, "https://push.example.com/sub");

        Assert.StartsWith(PublicOnlyConnector.PrivateAddressError, ex.Message);
    }

    [Fact]
    public async Task Send_RefusesAHostThatResolvesToAMixOfPublicAndPrivateAddresses()
    {
        var connector = new PublicOnlyConnector((_, _) => ResolvesTo("203.0.113.9", "10.0.0.12"));

        HttpRequestException ex = await SendThrough(connector, "https://push.example.com/sub");

        Assert.StartsWith(PublicOnlyConnector.PrivateAddressError, ex.Message);
    }

    [Fact]
    public async Task Send_RefusesAPrivateLiteralWithoutResolving()
    {
        bool resolved = false;
        var connector = new PublicOnlyConnector((_, _) => { resolved = true; return ResolvesTo("203.0.113.9"); });

        HttpRequestException ex = await SendThrough(connector, "https://192.168.1.10/sub");

        Assert.StartsWith(PublicOnlyConnector.PrivateAddressError, ex.Message);
        Assert.False(resolved);
    }
}
