using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// The readiness checklist behind the admin's Native app screen. Every check is pinned on both
/// sides of its boundary: the checklist is the only thing telling a self-hoster why a store
/// submission or a Universal Link will be rejected, and a check that silently passes is worse
/// than no check.
/// </summary>
public class NativeAppStatusServiceTests
{
    private const string PublicUrl = "https://bookings.example.com";

    private static readonly DateTime Now = new(2026, 8, 31, 12, 0, 0, DateTimeKind.Utc);

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => Now;
    }

    /// <summary>Answers per requested path; anything unmapped comes back as a well-formed document.</summary>
    private sealed class FakeProbe : IWellKnownProbe
    {
        private readonly Dictionary<string, WellKnownProbeResult> _byPath = [];

        public List<Uri> Requested { get; } = [];

        public FakeProbe()
        {
            Set(NativeAppChecks.AppleAssociationPath, Json("""{"applinks":{"details":[]}}"""));
            Set(NativeAppChecks.AndroidAssetLinksPath, Json("""[{"target":{"package_name":"to.openres.app"}}]"""));
        }

        public static WellKnownProbeResult Json(string body)
            => new(200, "application/json", body, Error: null);

        public FakeProbe Set(string path, WellKnownProbeResult result)
        {
            _byPath[path] = result;
            return this;
        }

        public Task<WellKnownProbeResult> FetchAsync(Uri url, CancellationToken cancellationToken = default)
        {
            Requested.Add(url);
            return Task.FromResult(_byPath[url.AbsolutePath]);
        }
    }

    private static IConfiguration Configuration(string? websiteUrl)
    {
        var config = new Mock<IConfiguration>();
        // "" rather than null: GetWebsiteUrl only consults the ambient environment when
        // configuration returns null, and the test must not depend on the machine's env vars.
        config.Setup(c => c[It.IsAny<string>()]).Returns(string.Empty);
        if (websiteUrl != null)
        {
            config.Setup(c => c["Website:Url"]).Returns(websiteUrl);
        }
        return config.Object;
    }

    private static async Task<NativeAppStatusResponse> StatusAsync(
        BrandSettings? brand = null,
        string? websiteUrl = PublicUrl,
        IWellKnownProbe? probe = null,
        IReadOnlyList<NativeClientSummary>? clients = null,
        IWalletCredentials? wallet = null)
    {
        // A fresh store per call: a test that asks for status twice is comparing two different
        // brand records, not appending a second one to the same.
        using AppDbContext db = TestDbFactory.Create(Guid.NewGuid().ToString());
        if (brand != null)
        {
            db.Set<BrandSettings>().Add(brand);
            await db.SaveChangesAsync();
        }

        var stats = new Mock<INativeClientStatsRepository>();
        stats.Setup(s => s.GetSummaryAsync(It.IsAny<DateTime>())).ReturnsAsync(clients ?? []);

        var service = new NativeAppStatusService(
            new BrandService(new BrandSettingsRepository(db), Configuration(websiteUrl)),
            stats.Object,
            probe ?? new FakeProbe(),
            new FixedClock(),
            wallet);

        return await service.GetStatusAsync();
    }

    private static NativeAppCheckDto Check(NativeAppStatusResponse status, string id)
        => Assert.Single(status.Checks, c => c.Id == id);

    private static BrandSettings Ready() => new()
    {
        AppName = "Paddy's Pub",
        PrimaryColor = "#059669",
        FaviconIcon = "pizza",
        PrivacyPolicyUrl = "https://openres.to/privacy",
    };

    [Fact]
    public async Task ReturnsTheSevenChecksInAFixedOrder()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready());

        Assert.Equal(
            [
                NativeAppChecks.Https,
                NativeAppChecks.BrandIcon,
                NativeAppChecks.PrivacyPolicy,
                NativeAppChecks.AppleAppSiteAssociation,
                NativeAppChecks.AndroidAssetLinks,
                NativeAppChecks.AppleWallet,
                NativeAppChecks.GoogleWallet,
            ],
            status.Checks.Select(c => c.Id));
        Assert.All(status.Checks, c => Assert.False(string.IsNullOrWhiteSpace(c.Detail)));
    }

    [Fact]
    public async Task WalletChecks_SkipWhenNoIssuerIsConfigured()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready());

        Assert.Equal(NativeAppChecks.Skip, Check(status, NativeAppChecks.AppleWallet).Status);
        Assert.Equal(NativeAppChecks.Skip, Check(status, NativeAppChecks.GoogleWallet).Status);

        // Configuring one platform leaves the other skipped: they are independent issuers.
        NativeAppStatusResponse appleOnly = await StatusAsync(
            Ready(), wallet: new WalletTestCredentials.FakeWalletCredentials(WalletTestCredentials.AppleSigner(), null));
        Assert.Equal(NativeAppChecks.Pass, Check(appleOnly, NativeAppChecks.AppleWallet).Status);
        Assert.Equal(NativeAppChecks.Skip, Check(appleOnly, NativeAppChecks.GoogleWallet).Status);
    }

    [Fact]
    public async Task WalletChecks_PassForAConfiguredIssuer()
    {
        NativeAppStatusResponse status = await StatusAsync(
            Ready(),
            wallet: new WalletTestCredentials.FakeWalletCredentials(
                WalletTestCredentials.AppleSigner(), WalletTestCredentials.GoogleIssuer()));

        NativeAppCheckDto apple = Check(status, NativeAppChecks.AppleWallet);
        Assert.Equal(NativeAppChecks.Pass, apple.Status);
        Assert.Contains(WalletTestCredentials.PassTypeIdentifier, apple.Detail, StringComparison.Ordinal);
        Assert.Contains(WalletTestCredentials.TeamIdentifier, apple.Detail, StringComparison.Ordinal);

        NativeAppCheckDto google = Check(status, NativeAppChecks.GoogleWallet);
        Assert.Equal(NativeAppChecks.Pass, google.Status);
        Assert.Contains(WalletTestCredentials.GoogleIssuerId, google.Detail, StringComparison.Ordinal);
        Assert.Contains(WalletTestCredentials.GoogleServiceAccountEmail, google.Detail, StringComparison.Ordinal);
    }

    [Fact]
    public async Task WithNoPublicAddressConfigured_FailsHttpsAndSkipsTheWellKnownChecks()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready(), websiteUrl: null);

        Assert.Null(status.ServerUrl);
        Assert.Equal(NativeAppChecks.Fail, Check(status, NativeAppChecks.Https).Status);
        Assert.Contains("WEBSITE_URL", Check(status, NativeAppChecks.Https).Detail, StringComparison.Ordinal);
        Assert.Equal(NativeAppChecks.Skip, Check(status, NativeAppChecks.AppleAppSiteAssociation).Status);
        Assert.Equal(NativeAppChecks.Skip, Check(status, NativeAppChecks.AndroidAssetLinks).Status);
    }

    [Fact]
    public async Task WithAnHttpAddress_FailsTheHttpsCheck()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready(), websiteUrl: "http://bookings.example.com");

        Assert.Equal("http://bookings.example.com", status.ServerUrl);
        Assert.Equal(NativeAppChecks.Fail, Check(status, NativeAppChecks.Https).Status);
    }

    [Fact]
    public async Task WithAnHttpsAddress_PassesTheHttpsCheck()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready());

        Assert.Equal(PublicUrl, status.ServerUrl);
        Assert.Equal(NativeAppChecks.Pass, Check(status, NativeAppChecks.Https).Status);
    }

    [Fact]
    public async Task BrandIcon_PassesOnlyForADrawableIcon()
    {
        NativeAppStatusResponse withIcon = await StatusAsync(Ready());
        NativeAppCheckDto passed = Check(withIcon, NativeAppChecks.BrandIcon);

        Assert.Equal(NativeAppChecks.Pass, passed.Status);
        Assert.Equal(PublicUrl + NativeAppChecks.AppIconPath, passed.Url);

        BrandSettings noIcon = Ready();
        noIcon.FaviconIcon = null;
        Assert.Equal(NativeAppChecks.Fail,
            Check(await StatusAsync(noIcon), NativeAppChecks.BrandIcon).Status);
    }

    [Fact]
    public async Task PrivacyPolicy_FailsUntilAUrlIsSet()
    {
        BrandSettings without = Ready();
        without.PrivacyPolicyUrl = null;
        NativeAppCheckDto failed = Check(await StatusAsync(without), NativeAppChecks.PrivacyPolicy);

        Assert.Equal(NativeAppChecks.Fail, failed.Status);
        Assert.Null(failed.Url);

        NativeAppCheckDto passed = Check(await StatusAsync(Ready()), NativeAppChecks.PrivacyPolicy);
        Assert.Equal(NativeAppChecks.Pass, passed.Status);
        Assert.Equal("https://openres.to/privacy", passed.Url);
    }

    [Fact]
    public async Task ReportsTheConfiguredMinimumAppVersionAndClients()
    {
        BrandSettings brand = Ready();
        brand.MinimumAppVersion = "1.9.0";
        NativeClientSummary[] clients =
        [
            new("android", "1.9.0", Now, 123, 456),
            new("ios", "1.8.0", Now.AddDays(-3), 1, 2),
        ];

        NativeAppStatusResponse status = await StatusAsync(brand, clients: clients);

        Assert.Equal("1.9.0", status.MinimumAppVersion);
        Assert.Equal(["android", "ios"], status.Clients.Select(c => c.Platform));
        Assert.Equal(456, status.Clients[0].RequestsLast30Days);
    }

    [Fact]
    public async Task AppleAssociation_PassesOnJsonCarryingApplinks()
    {
        NativeAppStatusResponse status = await StatusAsync(Ready());
        NativeAppCheckDto check = Check(status, NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Pass, check.Status);
        Assert.Equal(PublicUrl + NativeAppChecks.AppleAssociationPath, check.Url);
        Assert.Equal("200 OK, application/json.", check.Detail);
    }

    [Fact]
    public async Task AppleAssociation_FailsOnANon200()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AppleAssociationPath, new WellKnownProbeResult(404, "text/html", "nope", null));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Equal("404 Not Found", check.Detail);
    }

    [Fact]
    public async Task AppleAssociation_FailsOnTheWrongContentType()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AppleAssociationPath,
            new WellKnownProbeResult(200, "text/html", """{"applinks":{}}""", null));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Equal("Content-Type is text/html; Apple requires application/json.", check.Detail);
    }

    [Fact]
    public async Task AppleAssociation_FailsWhenTheBodyIsNotJson()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AppleAssociationPath, FakeProbe.Json("<html>not json</html>"));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Contains("not valid JSON", check.Detail, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AppleAssociation_FailsWhenTheJsonHasNoApplinks()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AppleAssociationPath, FakeProbe.Json("""{"webcredentials":{}}"""));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Contains("applinks", check.Detail, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AppleAssociation_FailsWhenTheHostIsUnreachable()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AppleAssociationPath, WellKnownProbeResult.Unreachable("HttpRequestException"));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AppleAppSiteAssociation);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Equal("Could not connect (HttpRequestException).", check.Detail);
    }

    [Fact]
    public async Task AndroidAssetLinks_PassesOnAStatementArray()
    {
        NativeAppCheckDto check = Check(await StatusAsync(Ready()), NativeAppChecks.AndroidAssetLinks);

        Assert.Equal(NativeAppChecks.Pass, check.Status);
        Assert.Equal(PublicUrl + NativeAppChecks.AndroidAssetLinksPath, check.Url);
    }

    [Fact]
    public async Task AndroidAssetLinks_FailsWhenTheJsonIsNotAStatementArray()
    {
        var probe = new FakeProbe().Set(
            NativeAppChecks.AndroidAssetLinksPath, FakeProbe.Json("""{"relation":[]}"""));

        NativeAppCheckDto check = Check(
            await StatusAsync(Ready(), probe: probe), NativeAppChecks.AndroidAssetLinks);

        Assert.Equal(NativeAppChecks.Fail, check.Status);
        Assert.Contains("package_name", check.Detail, StringComparison.Ordinal);
    }

    /// <summary>
    /// The probe is an admin-triggered fetch, so what it may request is the one thing that keeps
    /// it from being an SSRF primitive: only this deployment's own configured address, and only
    /// the two well-known paths.
    /// </summary>
    [Fact]
    public async Task OnlyEverFetchesTheConfiguredAddressesWellKnownPaths()
    {
        var probe = new FakeProbe();

        await StatusAsync(Ready(), probe: probe);

        Assert.Equal(
            [
                new Uri(PublicUrl + NativeAppChecks.AppleAssociationPath),
                new Uri(PublicUrl + NativeAppChecks.AndroidAssetLinksPath),
            ],
            probe.Requested);
    }
}
