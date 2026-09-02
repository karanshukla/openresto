using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using OpenRestoApi.Infrastructure.Wallet;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The "Save to Google Wallet" link is a signed JWT Google verifies against the service account's
/// public key; a link whose signature, issuer or object id is off fails on Google's side with no
/// server-side trace, so each is pinned here against an independent verifier.
/// </summary>
public class GoogleWalletLinkBuilderTests
{
    private const string Origin = "https://bistro.example";

    private static readonly GoogleWalletIssuer Issuer = WalletTestCredentials.GoogleIssuer();
    private static readonly DateTimeOffset IssuedAt = new(2026, 6, 1, 12, 0, 0, TimeSpan.Zero);

    private static byte[] FromBase64Url(string value)
    {
        string padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }

    private static (string Header, string Body, string Signature) Parts(string saveUrl)
    {
        Assert.StartsWith(GoogleWalletLinkBuilder.SaveUrlBase, saveUrl, StringComparison.Ordinal);
        string[] parts = saveUrl[GoogleWalletLinkBuilder.SaveUrlBase.Length..].Split('.');
        Assert.Equal(3, parts.Length);
        return (parts[0], parts[1], parts[2]);
    }

    private static JsonElement Payload(string saveUrl)
        => JsonDocument.Parse(FromBase64Url(Parts(saveUrl).Body)).RootElement.Clone();

    private static JsonElement GenericObject(string saveUrl)
        => Assert.Single(Payload(saveUrl).GetProperty("payload").GetProperty("genericObjects").EnumerateArray());

    private static string Build(PassContent content, string? logoUrl = null)
        => GoogleWalletLinkBuilder.Build(content, Issuer, Origin, logoUrl, IssuedAt);

    [Fact]
    public void Build_ProducesASaveUrlWhoseJwtVerifiesWithTheIssuerKey()
    {
        PassContent content = WalletTestCredentials.SampleContent();

        string saveUrl = Build(content);
        (string header, string body, string signature) = Parts(saveUrl);

        using RSA verifier = WalletTestCredentials.PublicKeyOf(Issuer);
        Assert.True(verifier.VerifyData(
            Encoding.ASCII.GetBytes($"{header}.{body}"),
            FromBase64Url(signature),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1));

        JsonElement jose = JsonDocument.Parse(FromBase64Url(header)).RootElement;
        Assert.Equal("RS256", jose.GetProperty("alg").GetString());
        Assert.Equal("JWT", jose.GetProperty("typ").GetString());

        JsonElement payload = Payload(saveUrl);
        Assert.Equal(WalletTestCredentials.GoogleServiceAccountEmail, payload.GetProperty("iss").GetString());
        Assert.Equal("google", payload.GetProperty("aud").GetString());
        Assert.Equal("savetowallet", payload.GetProperty("typ").GetString());
        Assert.Equal(IssuedAt.ToUnixTimeSeconds(), payload.GetProperty("iat").GetInt64());
        Assert.Equal([Origin], payload.GetProperty("origins").EnumerateArray().Select(o => o.GetString()));

        JsonElement generic = GenericObject(saveUrl);
        Assert.Equal($"{WalletTestCredentials.GoogleIssuerId}.1-abc123", generic.GetProperty("id").GetString());
        Assert.Equal("ACTIVE", generic.GetProperty("state").GetString());
        Assert.Equal(content.ManageUrl, generic.GetProperty("barcode").GetProperty("value").GetString());
        Assert.Equal("#0a7ea4", generic.GetProperty("hexBackgroundColor").GetString());
    }

    [Fact]
    public void Build_NamesTheIssuerClassAndObjectDeterministically()
    {
        PassContent content = WalletTestCredentials.SampleContent(serialNumber: "7/ab c:123");
        string classId = $"{WalletTestCredentials.GoogleIssuerId}.{GoogleWalletLinkBuilder.ClassSuffix}";

        JsonElement first = GenericObject(Build(content));
        JsonElement again = GenericObject(Build(content));

        Assert.Equal($"{WalletTestCredentials.GoogleIssuerId}.7-ab-c-123", first.GetProperty("id").GetString());
        Assert.Equal(first.GetProperty("id").GetString(), again.GetProperty("id").GetString());
        Assert.Equal($"{WalletTestCredentials.GoogleIssuerId}.openresto-booking", classId);
        Assert.Equal(classId, first.GetProperty("classId").GetString());

        JsonElement inlinedClass = Assert.Single(
            Payload(Build(content)).GetProperty("payload").GetProperty("genericClasses").EnumerateArray());
        Assert.Equal(classId, inlinedClass.GetProperty("id").GetString());

        // An id that is already legal is kept verbatim.
        Assert.Equal(
            $"{WalletTestCredentials.GoogleIssuerId}.1-abc.123_x",
            GenericObject(Build(WalletTestCredentials.SampleContent(serialNumber: "1-abc.123_x"))).GetProperty("id").GetString());
    }

    [Fact]
    public void Build_OmitsTheLogoWithoutAPublicIcon()
    {
        PassContent content = WalletTestCredentials.SampleContent();

        JsonElement without = GenericObject(Build(content, logoUrl: null));
        Assert.False(without.TryGetProperty("logo", out _));

        const string logoUrl = "https://bistro.example/api/brand/pwa-icon-192.png";
        JsonElement with = GenericObject(Build(content, logoUrl));
        Assert.Equal(logoUrl, with.GetProperty("logo").GetProperty("sourceUri").GetProperty("uri").GetString());
    }
}
