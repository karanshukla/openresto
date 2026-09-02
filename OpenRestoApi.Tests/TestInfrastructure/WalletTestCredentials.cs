using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using OpenRestoApi.Core.Application;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Infrastructure.Wallet;

namespace OpenRestoApi.Tests.TestInfrastructure;

/// <summary>
/// In-test signing material for the wallet tests: self-signed RSA certificates standing in for
/// the Pass Type ID and WWDR certificates, and a bare RSA key standing in for a Google service
/// account. Nothing here touches disk; the credential-store tests write these out themselves.
/// </summary>
internal static class WalletTestCredentials
{
    public const string PassTypeIdentifier = "pass.com.example.bistro";
    public const string TeamIdentifier = "ABCDE12345";
    public const string GoogleIssuerId = "3388000000012345678";
    public const string GoogleServiceAccountEmail = "wallet@bistro-demo.iam.gserviceaccount.com";

    /// <summary>
    /// A self-signed certificate holding its private key. It is exported and re-imported as
    /// PKCS#12 so the key is a persisted one rather than the ephemeral handle
    /// <see cref="CertificateRequest.CreateSelfSigned"/> returns, which CMS signing rejects on
    /// some platforms.
    /// </summary>
    public static X509Certificate2 SelfSigned(string subject, string pkcs12Password = "")
    {
        using RSA key = RSA.Create(2048);
        var request = new CertificateRequest($"CN={subject}", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, false));
        DateTimeOffset now = DateTimeOffset.UtcNow;
        using X509Certificate2 ephemeral = request.CreateSelfSigned(now.AddDays(-1), now.AddYears(1));
        return X509CertificateLoader.LoadPkcs12(ephemeral.Export(X509ContentType.Pkcs12, pkcs12Password), pkcs12Password);
    }

    public static ApplePassSigner AppleSigner() => new(
        PassTypeIdentifier,
        TeamIdentifier,
        SelfSigned("Pass Type ID: pass.com.example.bistro"),
        SelfSigned("Apple Worldwide Developer Relations Certification Authority"));

    public static GoogleWalletIssuer GoogleIssuer() => new(GoogleIssuerId, GoogleServiceAccountEmail, RSA.Create(2048));

    /// <summary>The verifying half of an issuer's key, as a caller with only the JWT would hold it.</summary>
    public static RSA PublicKeyOf(GoogleWalletIssuer issuer)
    {
        RSA verifier = RSA.Create();
        verifier.ImportRSAPublicKey(issuer.PrivateKey.ExportRSAPublicKey(), out _);
        return verifier;
    }

    public static PassContent SampleContent(
        string serialNumber = "1-abc123",
        string? restaurantAddress = "1 Main St, Toronto",
        string? restaurantPhone = "+1 416 555 0100",
        string? guestName = "Alice Example",
        string? specialRequests = "Window seat",
        string backgroundHex = "#0a7ea4",
        string? iconSvgPaths = null) => new(
            SerialNumber: serialNumber,
            OrganizationName: "Paddy's Pub",
            Description: "Reservation at Bistro",
            RestaurantName: "Bistro",
            RestaurantAddress: restaurantAddress,
            RestaurantPhone: restaurantPhone,
            Starts: new DateTimeOffset(2026, 6, 20, 19, 0, 0, TimeSpan.FromHours(-4)),
            Ends: new DateTimeOffset(2026, 6, 20, 20, 30, 0, TimeSpan.FromHours(-4)),
            Seats: 4,
            BookingRef: "abc123",
            GuestName: guestName,
            SpecialRequests: specialRequests,
            ManageUrl: "https://bistro.example/booking-confirmation/abc123?email=alice%40example.com",
            BackgroundHex: backgroundHex,
            IconSvgPaths: iconSvgPaths ?? LucideIconPaths.Get("pizza"));

    /// <summary>What a test hands a service in place of <c>WalletCredentialStore</c>.</summary>
    public sealed record FakeWalletCredentials(ApplePassSigner? Apple, GoogleWalletIssuer? Google) : IWalletCredentials;
}
