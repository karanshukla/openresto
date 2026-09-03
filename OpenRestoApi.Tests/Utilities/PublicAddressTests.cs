using System.Net;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// The line between "an address the internet can reach" and "an address only this deployment
/// can": everything the server fetches on a caller's instruction is held to it, so both sides
/// of every range are pinned.
/// </summary>
public class PublicAddressTests
{
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("127.8.8.8")]
    [InlineData("10.0.0.5")]
    [InlineData("172.16.0.1")]
    [InlineData("172.31.255.255")]
    [InlineData("192.168.1.10")]
    [InlineData("169.254.169.254")]
    [InlineData("100.64.0.1")]
    [InlineData("0.0.0.0")]
    [InlineData("224.0.0.1")]
    [InlineData("::1")]
    [InlineData("::")]
    [InlineData("fe80::1")]
    [InlineData("fd12:3456::1")]
    [InlineData("::ffff:10.0.0.1")]
    public void IsPublic_RejectsLoopbackPrivateAndLinkLocalRanges(string address)
        => Assert.False(PublicAddress.IsPublic(IPAddress.Parse(address)));

    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("172.15.0.1")]
    [InlineData("172.32.0.1")]
    [InlineData("100.63.0.1")]
    [InlineData("100.128.0.1")]
    [InlineData("203.0.113.9")]
    [InlineData("2606:4700::1111")]
    [InlineData("::ffff:8.8.8.8")]
    public void IsPublic_AcceptsRoutableAddresses(string address)
        => Assert.True(PublicAddress.IsPublic(IPAddress.Parse(address)));

    [Theory]
    [InlineData("https://localhost/x")]
    [InlineData("https://LOCALHOST:8081/")]
    [InlineData("https://api.localhost/")]
    [InlineData("https://printer.local/")]
    [InlineData("https://metadata.internal/")]
    [InlineData("https://127.0.0.1/")]
    [InlineData("https://[::1]/")]
    [InlineData("https://10.1.2.3:8080/")]
    [InlineData("https://169.254.169.254/latest/meta-data")]
    public void IsPublicHost_RejectsLocalhostAndPrivateLiterals(string url)
        => Assert.False(PublicAddress.IsPublicHost(new Uri(url)));

    [Theory]
    [InlineData("https://bookings.example.com/")]
    [InlineData("https://8.8.8.8/")]
    [InlineData("https://[2606:4700::1111]/")]
    public void IsPublicHost_AcceptsPublicNamesAndLiterals(string url)
        => Assert.True(PublicAddress.IsPublicHost(new Uri(url)));
}
