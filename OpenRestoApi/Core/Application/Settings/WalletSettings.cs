namespace OpenRestoApi.Core.Application.Settings;

/// <summary>
/// Credentials for issuing Apple Wallet and Google Wallet passes. Bound from the <c>Wallet</c>
/// configuration section (<c>Wallet__Apple__PassTypeIdentifier</c> and so on as environment
/// variables). Each platform is independently optional: the booking screens only offer the
/// passes whose issuer is configured.
/// </summary>
public class WalletSettings
{
    public AppleWalletSettings Apple { get; set; } = new();
    public GoogleWalletSettings Google { get; set; } = new();
}

public class AppleWalletSettings
{
    /// <summary>The Pass Type ID registered in the Apple Developer account, e.g. <c>pass.com.example.bistro</c>.</summary>
    public string PassTypeIdentifier { get; set; } = string.Empty;

    /// <summary>The 10-character Apple Team ID the pass type belongs to.</summary>
    public string TeamIdentifier { get; set; } = string.Empty;

    /// <summary>Path to the Pass Type ID certificate with its private key, as a PKCS#12 (.p12) file.</summary>
    public string CertificatePath { get; set; } = string.Empty;

    public string? CertificatePassword { get; set; }

    /// <summary>Path to Apple's WWDR intermediate certificate (.cer or .pem), included in the signature chain.</summary>
    public string WwdrCertificatePath { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(PassTypeIdentifier) &&
        !string.IsNullOrWhiteSpace(TeamIdentifier) &&
        !string.IsNullOrWhiteSpace(CertificatePath) &&
        !string.IsNullOrWhiteSpace(WwdrCertificatePath);
}

public class GoogleWalletSettings
{
    /// <summary>The Google Wallet issuer ID from the Google Pay &amp; Wallet Console.</summary>
    public string IssuerId { get; set; } = string.Empty;

    /// <summary>Path to the service account's JSON key file (holds <c>client_email</c> and <c>private_key</c>).</summary>
    public string ServiceAccountKeyPath { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(IssuerId) &&
        !string.IsNullOrWhiteSpace(ServiceAccountKeyPath);
}
