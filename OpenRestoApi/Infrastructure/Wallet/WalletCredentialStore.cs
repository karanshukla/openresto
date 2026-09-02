using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using CustomAccessibility.Attributes;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;

namespace OpenRestoApi.Infrastructure.Wallet;

/// <summary>
/// Loads the signing material named in <c>WalletSettings</c> once and keeps it for the process:
/// a PKCS#12 and a service-account JSON are not things to re-read from disk per pass. A file that
/// fails to load is logged once and treated as "not configured" so the booking screens simply do
/// not offer that pass, rather than every guest hitting a 500.
/// </summary>
/// <seealso>WalletCredentialStoreTests.Apple_IsNullWhenNotConfigured</seealso>
/// <seealso>WalletCredentialStoreTests.Apple_LoadsAPkcs12AndAPemOrDerWwdr</seealso>
/// <seealso>WalletCredentialStoreTests.Apple_IsNullWhenTheFileCannotBeLoaded</seealso>
/// <seealso>WalletCredentialStoreTests.Google_LoadsTheServiceAccountKey</seealso>
/// <seealso>WalletCredentialStoreTests.Google_IsNullWhenTheKeyFileIsMalformed</seealso>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.WalletCredentialStoreTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.WalletPassServiceTests")]
[ExternalAccessAllowed]
internal sealed class WalletCredentialStore(IOptions<WalletSettings> options, ILogger<WalletCredentialStore> logger) : IWalletCredentials
{
    private readonly Lazy<ApplePassSigner?> _apple = new(() => LoadApple(options.Value.Apple, logger));
    private readonly Lazy<GoogleWalletIssuer?> _google = new(() => LoadGoogle(options.Value.Google, logger));

    public ApplePassSigner? Apple => _apple.Value;
    public GoogleWalletIssuer? Google => _google.Value;

    private static ApplePassSigner? LoadApple(AppleWalletSettings apple, ILogger logger)
    {
        if (!apple.IsConfigured)
        {
            return null;
        }

        try
        {
            X509Certificate2 certificate = X509CertificateLoader.LoadPkcs12FromFile(apple.CertificatePath, apple.CertificatePassword);
            X509Certificate2 wwdr = LoadCertificate(apple.WwdrCertificatePath);
            return new ApplePassSigner(apple.PassTypeIdentifier.Trim(), apple.TeamIdentifier.Trim(), certificate, wwdr);
        }
        catch (Exception ex) when (ex is IOException or CryptographicException or UnauthorizedAccessException)
        {
            logger.LogError(ex, "[Wallet] Apple Wallet is configured but its certificates could not be loaded; passes are disabled.");
            return null;
        }
    }

    /// <summary>Apple distributes the WWDR certificate as DER (.cer); operators often convert it to PEM. Both load.</summary>
    private static X509Certificate2 LoadCertificate(string path)
    {
        byte[] bytes = File.ReadAllBytes(path);
        return X509Certificate2.GetCertContentType(bytes) == X509ContentType.Cert
            ? X509CertificateLoader.LoadCertificate(bytes)
            : X509Certificate2.CreateFromPem(System.Text.Encoding.ASCII.GetString(bytes));
    }

    private static GoogleWalletIssuer? LoadGoogle(GoogleWalletSettings google, ILogger logger)
    {
        if (!google.IsConfigured)
        {
            return null;
        }

        try
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllBytes(google.ServiceAccountKeyPath));
            string? email = doc.RootElement.TryGetProperty("client_email", out JsonElement e) ? e.GetString() : null;
            string? pem = doc.RootElement.TryGetProperty("private_key", out JsonElement k) ? k.GetString() : null;
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(pem))
            {
                throw new CryptographicException("The service account key has no client_email or private_key.");
            }

            RSA key = RSA.Create();
            key.ImportFromPem(pem);
            return new GoogleWalletIssuer(google.IssuerId.Trim(), email, key);
        }
        catch (Exception ex) when (ex is IOException or CryptographicException or JsonException or UnauthorizedAccessException or ArgumentException)
        {
            logger.LogError(ex, "[Wallet] Google Wallet is configured but its service account key could not be loaded; passes are disabled.");
            return null;
        }
    }
}
