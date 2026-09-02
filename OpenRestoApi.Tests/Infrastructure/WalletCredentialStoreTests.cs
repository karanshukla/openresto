using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Infrastructure.Wallet;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The store is the one place a self-hoster's wallet files are read, and a file that fails to
/// load must degrade to "not configured" rather than to a 500 on every booking screen.
/// </summary>
public sealed class WalletCredentialStoreTests : IDisposable
{
    private const string Password = "p12-secret";

    private readonly string _dir = Path.Combine(Path.GetTempPath(), "openresto-wallet-" + Guid.NewGuid().ToString("N"));

    public WalletCredentialStoreTests()
    {
        Directory.CreateDirectory(_dir);
    }

    public void Dispose()
    {
        Directory.Delete(_dir, recursive: true);
    }

    private string Write(string name, byte[] bytes)
    {
        string path = Path.Combine(_dir, name);
        File.WriteAllBytes(path, bytes);
        return path;
    }

    private string Write(string name, string text) => Write(name, Encoding.UTF8.GetBytes(text));

    private static WalletCredentialStore Store(WalletSettings settings)
        => new(Options.Create(settings), NullLogger<WalletCredentialStore>.Instance);

    private AppleWalletSettings AppleFiles(X509Certificate2 passCert, X509Certificate2 wwdr, string wwdrFormat, string? password = Password) => new()
    {
        PassTypeIdentifier = " " + WalletTestCredentials.PassTypeIdentifier + " ",
        TeamIdentifier = WalletTestCredentials.TeamIdentifier,
        CertificatePath = Write("pass.p12", passCert.Export(X509ContentType.Pkcs12, Password)),
        CertificatePassword = password,
        WwdrCertificatePath = wwdrFormat == "pem"
            ? Write("wwdr.pem", wwdr.ExportCertificatePem())
            : Write("wwdr.cer", wwdr.Export(X509ContentType.Cert)),
    };

    [Fact]
    public void Apple_IsNullWhenNotConfigured()
    {
        WalletCredentialStore empty = Store(new WalletSettings());
        Assert.Null(empty.Apple);
        Assert.Null(empty.Google);

        // Every Apple field is required: naming the pass type without the certificates is still unconfigured.
        WalletCredentialStore partial = Store(new WalletSettings
        {
            Apple = new AppleWalletSettings
            {
                PassTypeIdentifier = WalletTestCredentials.PassTypeIdentifier,
                TeamIdentifier = WalletTestCredentials.TeamIdentifier,
            },
        });
        Assert.Null(partial.Apple);
    }

    [Theory]
    [InlineData("pem")]
    [InlineData("der")]
    public void Apple_LoadsAPkcs12AndAPemOrDerWwdr(string wwdrFormat)
    {
        using X509Certificate2 passCert = WalletTestCredentials.SelfSigned("Pass Type ID: pass.com.example.bistro");
        using X509Certificate2 wwdr = WalletTestCredentials.SelfSigned("Apple Worldwide Developer Relations CA");

        WalletCredentialStore store = Store(new WalletSettings { Apple = AppleFiles(passCert, wwdr, wwdrFormat) });

        ApplePassSigner signer = Assert.IsType<ApplePassSigner>(store.Apple);
        Assert.Equal(WalletTestCredentials.PassTypeIdentifier, signer.PassTypeIdentifier);
        Assert.Equal(WalletTestCredentials.TeamIdentifier, signer.TeamIdentifier);
        Assert.Equal(passCert.Thumbprint, signer.Certificate.Thumbprint);
        Assert.True(signer.Certificate.HasPrivateKey);
        Assert.Equal(wwdr.Thumbprint, signer.WwdrCertificate.Thumbprint);
        Assert.Same(signer, store.Apple);
    }

    [Fact]
    public void Apple_IsNullWhenTheFileCannotBeLoaded()
    {
        using X509Certificate2 passCert = WalletTestCredentials.SelfSigned("pass");
        using X509Certificate2 wwdr = WalletTestCredentials.SelfSigned("wwdr");

        AppleWalletSettings missing = AppleFiles(passCert, wwdr, "der");
        missing.CertificatePath = Path.Combine(_dir, "does-not-exist.p12");
        Assert.Null(Store(new WalletSettings { Apple = missing }).Apple);

        AppleWalletSettings wrongPassword = AppleFiles(passCert, wwdr, "der", password: "not-the-password");
        Assert.Null(Store(new WalletSettings { Apple = wrongPassword }).Apple);

        AppleWalletSettings garbageWwdr = AppleFiles(passCert, wwdr, "der");
        garbageWwdr.WwdrCertificatePath = Write("wwdr-garbage.cer", "this is not a certificate");
        Assert.Null(Store(new WalletSettings { Apple = garbageWwdr }).Apple);
    }

    private GoogleWalletSettings GoogleFile(string json) => new()
    {
        IssuerId = " " + WalletTestCredentials.GoogleIssuerId + " ",
        ServiceAccountKeyPath = Write("service-account.json", json),
    };

    [Fact]
    public void Google_LoadsTheServiceAccountKey()
    {
        using RSA key = RSA.Create(2048);
        string json = JsonSerializer.Serialize(new
        {
            type = "service_account",
            client_email = WalletTestCredentials.GoogleServiceAccountEmail,
            private_key = key.ExportPkcs8PrivateKeyPem(),
        });

        WalletCredentialStore store = Store(new WalletSettings { Google = GoogleFile(json) });

        GoogleWalletIssuer issuer = Assert.IsType<GoogleWalletIssuer>(store.Google);
        Assert.Equal(WalletTestCredentials.GoogleIssuerId, issuer.IssuerId);
        Assert.Equal(WalletTestCredentials.GoogleServiceAccountEmail, issuer.ServiceAccountEmail);

        byte[] data = Encoding.ASCII.GetBytes("header.body");
        byte[] signature = issuer.PrivateKey.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        Assert.True(key.VerifyData(data, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        Assert.Same(issuer, store.Google);
    }

    [Theory]
    [InlineData("""{"client_email":"wallet@example.iam.gserviceaccount.com"}""")]
    [InlineData("""{"private_key":"-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n"}""")]
    [InlineData("""{"client_email":"wallet@example.iam.gserviceaccount.com","private_key":"not a pem"}""")]
    [InlineData("this is not json")]
    public void Google_IsNullWhenTheKeyFileIsMalformed(string json)
    {
        Assert.Null(Store(new WalletSettings { Google = GoogleFile(json) }).Google);

        GoogleWalletSettings missing = GoogleFile(json);
        missing.ServiceAccountKeyPath = Path.Combine(_dir, "does-not-exist.json");
        Assert.Null(Store(new WalletSettings { Google = missing }).Google);
    }
}
