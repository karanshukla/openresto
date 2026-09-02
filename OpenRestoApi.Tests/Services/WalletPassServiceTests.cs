using System.IO.Compression;
using System.Security.Cryptography.Pkcs;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using OpenRestoApi.Infrastructure.Wallet;
using OpenRestoApi.Tests.TestInfrastructure;
using static OpenRestoApi.Tests.TestInfrastructure.WalletTestCredentials;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// The booking-to-pass boundary: who may fetch a pass (the ref-plus-email pair, with the same
/// 404 for a wrong email as for an unknown ref), which bookings never get one, and that the
/// times on the pass are the restaurant's wall clock rather than the server's.
/// </summary>
public class WalletPassServiceTests
{
    private const string PublicUrl = "https://bistro.example";
    private const string Ref = "abc123";
    private const string Email = "alice@example.com";

    private static readonly DateTime Now = new(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
    private static readonly ApplePassSigner Apple = AppleSigner();
    private static readonly GoogleWalletIssuer Google = GoogleIssuer();
    private static readonly IWalletCredentials Both = new FakeWalletCredentials(Apple, Google);

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => Now;
    }

    private static IConfiguration Configuration(string? websiteUrl)
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c[It.IsAny<string>()]).Returns(string.Empty);
        if (websiteUrl != null)
        {
            config.Setup(c => c["Website:Url"]).Returns(websiteUrl);
        }
        return config.Object;
    }

    private static BrandSettings Brand() => new()
    {
        AppName = "Paddy's Pub",
        PrimaryColor = "#059669",
        FaviconIcon = "pizza",
        PhoneNumber = "+1 416 555 0199",
    };

    private sealed class Fixture : IDisposable
    {
        public AppDbContext Db { get; } = TestDbFactory.Create(Guid.NewGuid().ToString());
        public Booking Booking { get; }

        public Fixture(BrandSettings? brand = null, bool cancelled = false)
        {
            var restaurant = new Restaurant
            {
                Id = 1,
                Name = "Bistro",
                Address = "1 Main St, Toronto",
                PhoneNumber = null,
                Timezone = "America/Toronto",
            };
            Booking = new Booking
            {
                BookingRef = Ref,
                RestaurantId = 1,
                CustomerEmail = Email,
                CustomerName = "Alice Example",
                Seats = 2,
                Date = new DateTime(2026, 6, 20, 23, 0, 0, DateTimeKind.Utc),
                EndTime = new DateTime(2026, 6, 21, 0, 30, 0, DateTimeKind.Utc),
                SpecialRequests = "Window seat",
                IsCancelled = cancelled,
            };
            Db.Restaurants.Add(restaurant);
            Db.Bookings.Add(Booking);
            Db.Set<BrandSettings>().Add(brand ?? Brand());
            Db.SaveChanges();
        }

        public WalletPassService Service(IWalletCredentials? credentials = null, string? websiteUrl = PublicUrl) => new(
            new BookingRepository(Db),
            credentials ?? Both,
            new BrandService(new BrandSettingsRepository(Db), Configuration(websiteUrl)),
            new FixedClock());

        public void Dispose() => Db.Dispose();
    }

    private static JsonElement PassJson(byte[] pkpass, out Dictionary<string, byte[]> files)
    {
        using var zip = new ZipArchive(new MemoryStream(pkpass), ZipArchiveMode.Read);
        files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        foreach (ZipArchiveEntry entry in zip.Entries)
        {
            using var buffer = new MemoryStream();
            using Stream stream = entry.Open();
            stream.CopyTo(buffer);
            files[entry.FullName] = buffer.ToArray();
        }

        return JsonDocument.Parse(files["pass.json"]).RootElement.Clone();
    }

    private static JsonElement GenericObject(string saveUrl)
    {
        string body = saveUrl[GoogleWalletLinkBuilder.SaveUrlBase.Length..].Split('.')[1]
            .Replace('-', '+').Replace('_', '/');
        body = body.PadRight(body.Length + (4 - body.Length % 4) % 4, '=');
        JsonElement payload = JsonDocument.Parse(Convert.FromBase64String(body)).RootElement.Clone();
        return Assert.Single(payload.GetProperty("payload").GetProperty("genericObjects").EnumerateArray());
    }

    [Fact]
    public async Task BuildApplePassAsync_ReturnsNullForAnUnknownRefOrWrongEmail()
    {
        using var fixture = new Fixture();
        WalletPassService service = fixture.Service();

        Assert.Null(await service.BuildApplePassAsync("nope42", Email));
        Assert.Null(await service.BuildApplePassAsync(Ref, "mallory@example.com"));
        Assert.NotNull(await service.BuildApplePassAsync(Ref, Email));
    }

    [Fact]
    public async Task BuildApplePassAsync_ThrowsWhenAppleIsNotConfigured()
    {
        using var fixture = new Fixture();
        WalletPassService service = fixture.Service(new FakeWalletCredentials(Apple: null, Google));

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => service.BuildApplePassAsync(Ref, Email));
        Assert.Equal(ErrorCodes.BookingWalletNotConfigured, ex.Code);
        Assert.False(service.Availability().Apple);
        Assert.True(service.Availability().Google);
    }

    [Fact]
    public async Task BuildApplePassAsync_RefusesACancelledBooking()
    {
        using var fixture = new Fixture(cancelled: true);
        WalletPassService service = fixture.Service();

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.BuildApplePassAsync(Ref, Email));
        Assert.Equal(ErrorCodes.BookingWalletCancelled, ex.Code);

        var google = await Assert.ThrowsAsync<ConflictException>(() => service.BuildGoogleSaveUrlAsync(Ref, Email));
        Assert.Equal(ErrorCodes.BookingWalletCancelled, google.Code);
    }

    [Fact]
    public async Task BuildApplePassAsync_ProducesASignedPassInTheRestaurantsTimezone()
    {
        using var fixture = new Fixture();

        byte[]? pkpass = await fixture.Service().BuildApplePassAsync(Ref, Email);

        Assert.NotNull(pkpass);
        JsonElement pass = PassJson(pkpass, out Dictionary<string, byte[]> files);
        Assert.Equal("2026-06-20T19:00:00-04:00", pass.GetProperty("relevantDate").GetString());
        JsonElement generic = pass.GetProperty("generic");
        Assert.Equal("7:00 PM", Assert.Single(generic.GetProperty("headerFields").EnumerateArray()).GetProperty("value").GetString());
        Assert.Equal("Sat 20 Jun 2026", generic.GetProperty("secondaryFields")[0].GetProperty("value").GetString());

        Assert.Equal("1-abc123", pass.GetProperty("serialNumber").GetString());
        Assert.Equal("Paddy's Pub", pass.GetProperty("organizationName").GetString());
        Assert.Equal("rgb(5, 150, 105)", pass.GetProperty("backgroundColor").GetString());
        Assert.Equal(
            $"{PublicUrl}/booking-confirmation/{Ref}?email=alice%40example.com",
            pass.GetProperty("barcodes")[0].GetProperty("message").GetString());
        // The location lists no phone, so the pass falls through to the brand's.
        Assert.Contains(generic.GetProperty("backFields").EnumerateArray(),
            f => f.GetProperty("key").GetString() == "phone" && f.GetProperty("value").GetString() == "+1 416 555 0199");

        var cms = new SignedCms(new ContentInfo(files["manifest.json"]), detached: true);
        cms.Decode(files["signature"]);
        cms.CheckSignature(verifySignatureOnly: true);
        Assert.Equal(Apple.Certificate.Thumbprint, Assert.Single(cms.SignerInfos.Cast<SignerInfo>()).Certificate!.Thumbprint);
    }

    [Fact]
    public async Task BuildGoogleSaveUrlAsync_ReturnsNullForAnUnknownRefOrWrongEmail()
    {
        using var fixture = new Fixture();
        WalletPassService service = fixture.Service();

        Assert.Null(await service.BuildGoogleSaveUrlAsync("nope42", Email));
        Assert.Null(await service.BuildGoogleSaveUrlAsync(Ref, "mallory@example.com"));
        Assert.NotNull(await service.BuildGoogleSaveUrlAsync(Ref, " ALICE@example.com "));
    }

    [Fact]
    public async Task BuildGoogleSaveUrlAsync_ThrowsWhenGoogleIsNotConfigured()
    {
        using var fixture = new Fixture();
        WalletPassService service = fixture.Service(new FakeWalletCredentials(Apple, Google: null));

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => service.BuildGoogleSaveUrlAsync(Ref, Email));
        Assert.Equal(ErrorCodes.BookingWalletNotConfigured, ex.Code);
        Assert.True(service.Availability().Apple);
        Assert.False(service.Availability().Google);
    }

    [Fact]
    public async Task BuildGoogleSaveUrlAsync_ProducesASaveLinkWithTheBrandLogoWhenPublic()
    {
        using var https = new Fixture();
        string? saveUrl = await https.Service().BuildGoogleSaveUrlAsync(Ref, Email);
        Assert.NotNull(saveUrl);
        JsonElement generic = GenericObject(saveUrl);
        Assert.Equal($"{WalletTestCredentials.GoogleIssuerId}.1-abc123", generic.GetProperty("id").GetString());
        Assert.Equal(
            "https://bistro.example/api/brand/pwa-icon-192.png",
            generic.GetProperty("logo").GetProperty("sourceUri").GetProperty("uri").GetString());
        Assert.Equal(
            $"{PublicUrl}/booking-confirmation/{Ref}?email=alice%40example.com",
            generic.GetProperty("barcode").GetProperty("value").GetString());
        Assert.Equal("2026-06-20T19:00:00.0000000-04:00",
            generic.GetProperty("validTimeInterval").GetProperty("start").GetProperty("date").GetString());

        // Google fetches the logo itself, so a plain-http address is as good as none.
        using var http = new Fixture();
        string? overHttp = await http.Service(websiteUrl: "http://bistro.example").BuildGoogleSaveUrlAsync(Ref, Email);
        Assert.NotNull(overHttp);
        Assert.False(GenericObject(overHttp).TryGetProperty("logo", out _));

        BrandSettings noIcon = Brand();
        noIcon.FaviconIcon = null;
        using var iconless = new Fixture(noIcon);
        string? withoutIcon = await iconless.Service().BuildGoogleSaveUrlAsync(Ref, Email);
        Assert.NotNull(withoutIcon);
        Assert.False(GenericObject(withoutIcon).TryGetProperty("logo", out _));
    }
}
