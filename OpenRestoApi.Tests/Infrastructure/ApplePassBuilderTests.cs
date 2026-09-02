using System.IO.Compression;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using ImageMagick;
using OpenRestoApi.Infrastructure.Wallet;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The <c>.pkpass</c> container: Wallet rejects a pass whose manifest misses a file, whose
/// signature does not cover the manifest, or whose pass.json names the wrong identifiers, and it
/// does so silently on the phone. These pin every one of those on the server.
/// </summary>
public class ApplePassBuilderTests
{
    private static readonly ApplePassSigner Signer = WalletTestCredentials.AppleSigner();

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static Dictionary<string, byte[]> Unzip(byte[] pkpass)
    {
        using var zip = new ZipArchive(new MemoryStream(pkpass), ZipArchiveMode.Read);
        Dictionary<string, byte[]> files = new(StringComparer.Ordinal);
        foreach (ZipArchiveEntry entry in zip.Entries)
        {
            using var buffer = new MemoryStream();
            using Stream stream = entry.Open();
            stream.CopyTo(buffer);
            files[entry.FullName] = buffer.ToArray();
        }

        return files;
    }

    private static JsonElement PassJson(Dictionary<string, byte[]> files)
        => JsonDocument.Parse(files["pass.json"]).RootElement.Clone();

    private static IEnumerable<string> Keys(JsonElement fields)
        => fields.EnumerateArray().Select(f => f.GetProperty("key").GetString()!);

    [Fact]
    public void Build_WritesAPassJsonNamingTheIdentifiersAndSerial()
    {
        PassContent content = WalletTestCredentials.SampleContent();

        JsonElement pass = PassJson(Unzip(ApplePassBuilder.Build(content, Signer)));

        Assert.Equal(1, pass.GetProperty("formatVersion").GetInt32());
        Assert.Equal(WalletTestCredentials.PassTypeIdentifier, pass.GetProperty("passTypeIdentifier").GetString());
        Assert.Equal(WalletTestCredentials.TeamIdentifier, pass.GetProperty("teamIdentifier").GetString());
        Assert.Equal("1-abc123", pass.GetProperty("serialNumber").GetString());
        Assert.Equal("Paddy's Pub", pass.GetProperty("organizationName").GetString());
        Assert.Equal("Reservation at Bistro", pass.GetProperty("description").GetString());

        JsonElement primary = Assert.Single(pass.GetProperty("generic").GetProperty("primaryFields").EnumerateArray());
        Assert.Equal("restaurant", primary.GetProperty("key").GetString());
        Assert.Equal("Bistro", primary.GetProperty("value").GetString());

        JsonElement barcode = Assert.Single(pass.GetProperty("barcodes").EnumerateArray());
        Assert.Equal("PKBarcodeFormatQR", barcode.GetProperty("format").GetString());
        Assert.Equal(content.ManageUrl, barcode.GetProperty("message").GetString());
        Assert.Equal("abc123", barcode.GetProperty("altText").GetString());

        Assert.Equal("2026-06-20T19:00:00-04:00", pass.GetProperty("relevantDate").GetString());
        Assert.Equal("2026-06-21T08:30:00-04:00", pass.GetProperty("expirationDate").GetString());
    }

    [Fact]
    public void Build_ManifestHashesEveryFileButItselfAndTheSignature()
    {
        Dictionary<string, byte[]> files = Unzip(ApplePassBuilder.Build(WalletTestCredentials.SampleContent(), Signer));

        Dictionary<string, string> manifest = JsonSerializer.Deserialize<Dictionary<string, string>>(files["manifest.json"])!;
        string[] hashed = [.. files.Keys.Where(name => name is not ("manifest.json" or "signature")).Order()];

        Assert.Equal(hashed, manifest.Keys.Order());
        foreach ((string name, string hash) in manifest)
        {
            Assert.Equal(Convert.ToHexStringLower(SHA1.HashData(files[name])), hash);
        }

        (string Name, int Size)[] images =
        [
            ("icon.png", 29), ("icon@2x.png", 58), ("icon@3x.png", 87),
            ("logo.png", 50), ("logo@2x.png", 100), ("logo@3x.png", 150),
        ];
        foreach ((string name, int size) in images)
        {
            byte[] png = files[name];
            Assert.Equal(PngSignature, png.Take(PngSignature.Length));
            using var image = new MagickImage(png);
            Assert.Equal((uint)size, image.Width);
            Assert.Equal((uint)size, image.Height);
        }

        Assert.Equal(
            new[] { "pass.json" }.Concat(images.Select(i => i.Name)).Order(),
            hashed);
    }

    [Fact]
    public void Build_SignatureVerifiesAgainstTheManifest()
    {
        Dictionary<string, byte[]> files = Unzip(ApplePassBuilder.Build(WalletTestCredentials.SampleContent(), Signer));

        var cms = new SignedCms(new ContentInfo(files["manifest.json"]), detached: true);
        cms.Decode(files["signature"]);
        cms.CheckSignature(verifySignatureOnly: true);

        SignerInfo signer = Assert.Single(cms.SignerInfos.Cast<SignerInfo>());
        Assert.Equal(Signer.Certificate.Thumbprint, signer.Certificate!.Thumbprint);
        Assert.Contains(cms.Certificates, c => c.Thumbprint == Signer.WwdrCertificate.Thumbprint);

        // Tamper with the manifest and the same signature must no longer check out.
        byte[] tampered = [.. files["manifest.json"]];
        tampered[^2] ^= 0x01;
        var forged = new SignedCms(new ContentInfo(tampered), detached: true);
        forged.Decode(files["signature"]);
        Assert.Throws<CryptographicException>(() => forged.CheckSignature(verifySignatureOnly: true));
    }

    [Fact]
    public void Build_UsesTheBrandColourAndSkipsBlankBackFields()
    {
        PassContent sparse = WalletTestCredentials.SampleContent(
            restaurantAddress: null,
            restaurantPhone: null,
            guestName: null,
            specialRequests: null,
            backgroundHex: "#059669");

        JsonElement pass = PassJson(Unzip(ApplePassBuilder.Build(sparse, Signer)));
        JsonElement generic = pass.GetProperty("generic");

        Assert.Equal("rgb(5, 150, 105)", pass.GetProperty("backgroundColor").GetString());
        Assert.Equal(["manage"], Keys(generic.GetProperty("backFields")));
        Assert.Equal(["ref"], Keys(generic.GetProperty("auxiliaryFields")));

        JsonElement full = PassJson(Unzip(ApplePassBuilder.Build(WalletTestCredentials.SampleContent(), Signer)))
            .GetProperty("generic");
        Assert.Equal(["address", "phone", "requests", "manage"], Keys(full.GetProperty("backFields")));
        Assert.Equal(["ref", "name"], Keys(full.GetProperty("auxiliaryFields")));
    }

    [Theory]
    [InlineData("#0a7ea4", "rgb(10, 126, 164)")]
    [InlineData("0A7EA4", "rgb(10, 126, 164)")]
    [InlineData("#fff", "rgb(255, 255, 255)")]
    [InlineData("#059669", "rgb(5, 150, 105)")]
    [InlineData("not-a-colour", "rgb(10, 126, 164)")]
    [InlineData("#12345", "rgb(10, 126, 164)")]
    [InlineData("", "rgb(10, 126, 164)")]
    public void Rgb_ConvertsSixAndThreeDigitHex(string hex, string expected)
    {
        Assert.Equal(expected, ApplePassBuilder.Rgb(hex));
    }
}
