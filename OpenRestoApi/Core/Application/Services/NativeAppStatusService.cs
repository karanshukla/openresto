using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Answers "could a self-hoster ship the native guest app from this instance today?" — the five
/// deployment facts a store submission and Universal/App Links depend on, plus what the builds
/// already out there are doing. Everything here is read-only state about the deployment itself.
/// </summary>
public class NativeAppStatusService(
    BrandService brandService,
    INativeClientStatsRepository clientStats,
    IWellKnownProbe probe,
    ISystemClock clock,
    IWalletCredentials? wallet = null)
{
    private readonly BrandService _brand = brandService;
    private readonly INativeClientStatsRepository _clientStats = clientStats;
    private readonly IWellKnownProbe _probe = probe;
    private readonly ISystemClock _clock = clock;
    private readonly IWalletCredentials _wallet = wallet ?? NoWalletCredentials.Instance;

    /// <summary>
    /// <seealso>NativeAppStatusServiceTests.WithNoPublicAddressConfigured_FailsHttpsAndSkipsTheWellKnownChecks</seealso>
    /// <seealso>NativeAppStatusServiceTests.WithAnHttpAddress_FailsTheHttpsCheck</seealso>
    /// <seealso>NativeAppStatusServiceTests.WithAnHttpsAddress_PassesTheHttpsCheck</seealso>
    /// <seealso>NativeAppStatusServiceTests.BrandIcon_PassesOnlyForADrawableIcon</seealso>
    /// <seealso>NativeAppStatusServiceTests.PrivacyPolicy_FailsUntilAUrlIsSet</seealso>
    /// <seealso>NativeAppStatusServiceTests.ReportsTheConfiguredMinimumAppVersionAndClients</seealso>
    /// </summary>
    public async Task<NativeAppStatusResponse> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        BrandSettings brand = await _brand.GetAsync();
        string websiteUrl = _brand.GetWebsiteUrl(brand);
        bool hasPublicAddress = !string.Equals(websiteUrl, BrandService.DefaultWebsiteUrl, StringComparison.Ordinal);

        var checks = new List<NativeAppCheckDto>
        {
            Https(websiteUrl, hasPublicAddress),
            BrandIcon(brand, websiteUrl, hasPublicAddress),
            PrivacyPolicy(brand),
            await AppleAppSiteAssociationAsync(websiteUrl, hasPublicAddress, cancellationToken),
            await AndroidAssetLinksAsync(websiteUrl, hasPublicAddress, cancellationToken),
            AppleWallet(),
            GoogleWallet(),
        };

        return new NativeAppStatusResponse
        {
            ServerUrl = hasPublicAddress ? websiteUrl : null,
            Checks = checks,
            MinimumAppVersion = brand.MinimumAppVersion,
            Clients = [.. await _clientStats.GetSummaryAsync(_clock.UtcNow)],
        };
    }

    private static NativeAppCheckDto Check(string id, string status, string detail, string? url = null)
        => new() { Id = id, Status = status, Detail = detail, Url = url };

    private static string Absolute(string websiteUrl, string path) => websiteUrl.TrimEnd('/') + path;

    private static NativeAppCheckDto Https(string websiteUrl, bool hasPublicAddress)
    {
        if (!hasPublicAddress)
        {
            return Check(NativeAppChecks.Https, NativeAppChecks.Fail,
                "No public address is configured. Set WEBSITE_URL (or CORS_ORIGINS) to the address guests reach this server on.");
        }

        bool isHttps = Uri.TryCreate(websiteUrl, UriKind.Absolute, out Uri? uri) && uri.Scheme == Uri.UriSchemeHttps;
        return isHttps
            ? Check(NativeAppChecks.Https, NativeAppChecks.Pass, "The public address is served over HTTPS.")
            : Check(NativeAppChecks.Https, NativeAppChecks.Fail,
                "The public address is not HTTPS. Both stores and the deep-link verifiers require it.");
    }

    private static NativeAppCheckDto BrandIcon(BrandSettings brand, string websiteUrl, bool hasPublicAddress)
    {
        string? url = hasPublicAddress ? Absolute(websiteUrl, NativeAppChecks.AppIconPath) : null;
        bool hasIcon = !string.IsNullOrEmpty(brand.FaviconIcon) && LucideIconPaths.Get(brand.FaviconIcon) != null;

        return hasIcon
            ? Check(NativeAppChecks.BrandIcon, NativeAppChecks.Pass,
                "A brand icon is set, so the build bakes in this instance's own artwork.", url)
            : Check(NativeAppChecks.BrandIcon, NativeAppChecks.Fail,
                "No brand icon chosen; the build will use OpenResto's bundled artwork.", url);
    }

    private static NativeAppCheckDto PrivacyPolicy(BrandSettings brand)
        => string.IsNullOrWhiteSpace(brand.PrivacyPolicyUrl)
            ? Check(NativeAppChecks.PrivacyPolicy, NativeAppChecks.Fail,
                "Both stores require a privacy policy URL before a listing can be published.")
            : Check(NativeAppChecks.PrivacyPolicy, NativeAppChecks.Pass,
                "A privacy policy URL is set.", brand.PrivacyPolicyUrl);

    /// <summary>
    /// Wallet passes are optional, so an unconfigured issuer is a skip rather than a failure: nothing
    /// is broken, the guest screens simply do not offer that pass.
    /// <seealso>NativeAppStatusServiceTests.WalletChecks_SkipWhenNoIssuerIsConfigured</seealso>
    /// <seealso>NativeAppStatusServiceTests.WalletChecks_PassForAConfiguredIssuer</seealso>
    /// </summary>
    private NativeAppCheckDto AppleWallet()
        => _wallet.Apple is { } apple
            ? Check(NativeAppChecks.AppleWallet, NativeAppChecks.Pass,
                $"Passes are signed as {apple.PassTypeIdentifier} (team {apple.TeamIdentifier}).")
            : Check(NativeAppChecks.AppleWallet, NativeAppChecks.Skip,
                "No Pass Type ID certificate is configured, so bookings offer no Apple Wallet pass.");

    private NativeAppCheckDto GoogleWallet()
        => _wallet.Google is { } google
            ? Check(NativeAppChecks.GoogleWallet, NativeAppChecks.Pass,
                $"Passes are issued under issuer {google.IssuerId} by {google.ServiceAccountEmail}.")
            : Check(NativeAppChecks.GoogleWallet, NativeAppChecks.Skip,
                "No Google Wallet issuer is configured, so bookings offer no Google Wallet pass.");

    /// <summary>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_PassesOnJsonCarryingApplinks</seealso>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_FailsOnANon200</seealso>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_FailsOnTheWrongContentType</seealso>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_FailsWhenTheBodyIsNotJson</seealso>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_FailsWhenTheJsonHasNoApplinks</seealso>
    /// <seealso>NativeAppStatusServiceTests.AppleAssociation_FailsWhenTheHostIsUnreachable</seealso>
    /// </summary>
    private async Task<NativeAppCheckDto> AppleAppSiteAssociationAsync(
        string websiteUrl, bool hasPublicAddress, CancellationToken cancellationToken)
    {
        return await WellKnownCheckAsync(
            NativeAppChecks.AppleAppSiteAssociation,
            NativeAppChecks.AppleAssociationPath,
            "Apple",
            websiteUrl,
            hasPublicAddress,
            HasApplinks,
            "The JSON carries no applinks section, so iOS will not associate the app with this domain.",
            cancellationToken);
    }

    /// <summary>
    /// <seealso>NativeAppStatusServiceTests.AndroidAssetLinks_PassesOnAStatementArray</seealso>
    /// <seealso>NativeAppStatusServiceTests.AndroidAssetLinks_FailsWhenTheJsonIsNotAStatementArray</seealso>
    /// <seealso>NativeAppStatusServiceTests.WellKnownChecks_SkipAPrivateNetworkAddressWithoutFetching</seealso>
    /// <seealso>NativeAppStatusServiceTests.WellKnownChecks_FailOnARedirect</seealso>
    /// </summary>
    private async Task<NativeAppCheckDto> AndroidAssetLinksAsync(
        string websiteUrl, bool hasPublicAddress, CancellationToken cancellationToken)
    {
        return await WellKnownCheckAsync(
            NativeAppChecks.AndroidAssetLinks,
            NativeAppChecks.AndroidAssetLinksPath,
            "Android",
            websiteUrl,
            hasPublicAddress,
            HasPackageNameStatement,
            "The JSON is not a statement list naming a target.package_name, so App Links will not verify.",
            cancellationToken);
    }

    private async Task<NativeAppCheckDto> WellKnownCheckAsync(
        string id,
        string path,
        string platform,
        string websiteUrl,
        bool hasPublicAddress,
        Func<JsonElement, bool> isWellFormed,
        string malformedDetail,
        CancellationToken cancellationToken)
    {
        if (!hasPublicAddress)
        {
            return Check(id, NativeAppChecks.Skip,
                "Skipped: there is no public address to fetch this from yet.");
        }

        if (!NativeAppChecks.TryBuildWellKnownUrl(websiteUrl, path, out Uri absolute))
        {
            return Check(id, NativeAppChecks.Skip,
                "Skipped: the configured public address is not an http(s) URL this can be fetched from.");
        }

        string url = absolute.ToString();
        if (!PublicAddress.IsPublicHost(absolute))
        {
            return Check(id, NativeAppChecks.Skip,
                "Skipped: the public address is a local or private-network address, which a store's verifier could not reach either.", url);
        }

        WellKnownProbeResult result = await _probe.FetchAsync(absolute, cancellationToken);

        if (result.Error != null)
        {
            return Check(id, NativeAppChecks.Fail, $"Could not connect ({result.Error}).", url);
        }

        int status = result.StatusCode ?? 0;
        if (status is >= 300 and < 400)
        {
            return Check(id, NativeAppChecks.Fail,
                $"{StatusLine(status)}: the file redirects, and neither verifier follows redirects.", url);
        }

        if (status != StatusCodes.Status200OK)
        {
            return Check(id, NativeAppChecks.Fail, StatusLine(status), url);
        }

        if (!string.Equals(result.ContentType, NativeAppChecks.RequiredContentType, StringComparison.OrdinalIgnoreCase))
        {
            string seen = string.IsNullOrEmpty(result.ContentType) ? "missing" : result.ContentType;
            return Check(id, NativeAppChecks.Fail,
                $"Content-Type is {seen}; {platform} requires {NativeAppChecks.RequiredContentType}.", url);
        }

        if (!TryParseJson(result.Body, out JsonElement root))
        {
            return Check(id, NativeAppChecks.Fail, "200 OK, but the body is not valid JSON.", url);
        }

        return isWellFormed(root)
            ? Check(id, NativeAppChecks.Pass, $"{StatusLine(status)}, {NativeAppChecks.RequiredContentType}.", url)
            : Check(id, NativeAppChecks.Fail, malformedDetail, url);
    }

    private static string StatusLine(int status)
        => string.Concat(
            status.ToString(CultureInfo.InvariantCulture),
            " ",
            ReasonPhrases.GetReasonPhrase(status) is { Length: > 0 } phrase ? phrase : "Unknown");

    private static bool TryParseJson(string? body, out JsonElement root)
    {
        root = default;
        if (string.IsNullOrWhiteSpace(body)) return false;

        try
        {
            using var document = JsonDocument.Parse(body);
            root = document.RootElement.Clone();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool HasApplinks(JsonElement root)
        => root.ValueKind == JsonValueKind.Object && root.TryGetProperty("applinks", out _);

    private static bool HasPackageNameStatement(JsonElement root)
        => root.ValueKind == JsonValueKind.Array
            && root.GetArrayLength() > 0
            && root[0].ValueKind == JsonValueKind.Object
            && root[0].TryGetProperty("target", out JsonElement target)
            && target.ValueKind == JsonValueKind.Object
            && target.TryGetProperty("package_name", out _);
}
