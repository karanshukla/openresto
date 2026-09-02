using OpenRestoApi.Infrastructure.Wallet;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>The loaded wallet signing identities; null for a platform that is not configured or whose files failed to load.</summary>
public interface IWalletCredentials
{
    ApplePassSigner? Apple { get; }
    GoogleWalletIssuer? Google { get; }
}

/// <summary>The null object: no issuer on either platform.</summary>
public sealed class NoWalletCredentials : IWalletCredentials
{
    public static readonly NoWalletCredentials Instance = new();
    public ApplePassSigner? Apple => null;
    public GoogleWalletIssuer? Google => null;
}
