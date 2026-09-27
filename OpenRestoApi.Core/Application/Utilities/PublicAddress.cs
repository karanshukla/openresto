using System.Net;
using System.Net.Sockets;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Whether an address is one the outside world could reach. Everything the server fetches on an
/// admin's or a guest's say-so — the deployment's own <c>/.well-known/</c> documents, a browser's
/// Web Push endpoint — has to clear this, or a URL that resolves to the Docker network, a cloud
/// metadata service or the host's own loopback becomes a request the server makes on the caller's
/// behalf. A pure classifier: DNS is the caller's business.
/// </summary>
/// <seealso>PublicAddressTests.IsPublic_RejectsLoopbackPrivateAndLinkLocalRanges</seealso>
/// <seealso>PublicAddressTests.IsPublic_AcceptsRoutableAddresses</seealso>
/// <seealso>PublicAddressTests.IsPublicHost_RejectsLocalhostAndPrivateLiterals</seealso>
public static class PublicAddress
{
    public static bool IsPublic(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (IPAddress.IsLoopback(address) || address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any))
        {
            return false;
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            return !address.IsIPv6LinkLocal
                && !address.IsIPv6SiteLocal
                && !address.IsIPv6UniqueLocal
                && !address.IsIPv6Multicast;
        }

        byte[] bytes = address.GetAddressBytes();
        return bytes[0] switch
        {
            10 => false,                                   // 10.0.0.0/8
            127 => false,                                  // 127.0.0.0/8
            169 when bytes[1] == 254 => false,             // 169.254.0.0/16 (link-local, cloud metadata)
            172 when bytes[1] is >= 16 and <= 31 => false, // 172.16.0.0/12 (Docker's default bridges)
            192 when bytes[1] == 168 => false,             // 192.168.0.0/16
            100 when bytes[1] is >= 64 and <= 127 => false, // 100.64.0.0/10 (carrier NAT)
            0 => false,
            >= 224 => false,                               // multicast and reserved
            _ => true,
        };
    }

    /// <summary>
    /// The literal-only half: <c>localhost</c> and an IP written into the URL. A host name that
    /// merely resolves to a private address is only knowable after a lookup, which is the
    /// fetching side's job.
    /// </summary>
    public static bool IsPublicHost(Uri url)
    {
        if (url.HostNameType == UriHostNameType.IPv4 || url.HostNameType == UriHostNameType.IPv6)
        {
            return IPAddress.TryParse(url.Host.Trim('[', ']'), out IPAddress? literal) && IsPublic(literal);
        }

        string host = url.Host;
        return !string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            && !host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
            && !host.EndsWith(".local", StringComparison.OrdinalIgnoreCase)
            && !host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase);
    }
}
