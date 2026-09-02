using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Text.Json.Serialization;
using OpenRestoApi.Core.Application;

namespace OpenRestoApi.Infrastructure.Wallet;

/// <summary>
/// Everything a pass says, resolved by the caller so this class knows nothing about bookings.
/// Dates arrive already in the restaurant's wall-clock time with its offset, because a pass is
/// read in whatever timezone the phone is in and a reservation is at the restaurant.
/// </summary>
public sealed record PassContent(
    string SerialNumber,
    string OrganizationName,
    string Description,
    string RestaurantName,
    string? RestaurantAddress,
    string? RestaurantPhone,
    DateTimeOffset Starts,
    DateTimeOffset Ends,
    int Seats,
    string BookingRef,
    string? GuestName,
    string? SpecialRequests,
    string ManageUrl,
    string BackgroundHex,
    string? IconSvgPaths);

/// <summary>
/// The identity a pass is signed under. Loaded once from <c>WalletSettings</c> by the caller.
/// </summary>
public sealed record ApplePassSigner(
    string PassTypeIdentifier,
    string TeamIdentifier,
    X509Certificate2 Certificate,
    X509Certificate2 WwdrCertificate);

/// <summary>
/// Builds a <c>.pkpass</c>: <c>pass.json</c>, the icon set, a SHA-1 manifest and a detached
/// PKCS#7 signature over it, zipped. The layout is a generic pass rather than an event ticket
/// because a reservation has no venue barcode to scan; the QR carries the manage link instead.
/// </summary>
/// <seealso>ApplePassBuilderTests.Build_WritesAPassJsonNamingTheIdentifiersAndSerial</seealso>
/// <seealso>ApplePassBuilderTests.Build_ManifestHashesEveryFileButItselfAndTheSignature</seealso>
/// <seealso>ApplePassBuilderTests.Build_SignatureVerifiesAgainstTheManifest</seealso>
/// <seealso>ApplePassBuilderTests.Build_UsesTheBrandColourAndSkipsBlankBackFields</seealso>
public static class ApplePassBuilder
{
    /// <summary>Apple's icon sizes: 29pt at 1x/2x/3x, and a square logo at 50pt.</summary>
    private static readonly (string Name, int Size)[] Images =
    [
        ("icon.png", 29), ("icon@2x.png", 58), ("icon@3x.png", 87),
        ("logo.png", 50), ("logo@2x.png", 100), ("logo@3x.png", 150),
    ];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static byte[] Build(PassContent content, ApplePassSigner signer)
    {
        Dictionary<string, byte[]> files = new(StringComparer.Ordinal)
        {
            ["pass.json"] = JsonSerializer.SerializeToUtf8Bytes(PassJson(content, signer), JsonOptions),
        };
        foreach ((string name, int size) in Images)
        {
            files[name] = PwaIconGenerator.Generate(size, content.BackgroundHex, content.IconSvgPaths ?? string.Empty);
        }

        byte[] manifest = JsonSerializer.SerializeToUtf8Bytes(
            files.ToDictionary(f => f.Key, f => Convert.ToHexStringLower(SHA1.HashData(f.Value))));
        files["manifest.json"] = manifest;
        files["signature"] = Sign(manifest, signer);

        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach ((string name, byte[] bytes) in files)
            {
                using Stream entry = zip.CreateEntry(name, CompressionLevel.Optimal).Open();
                entry.Write(bytes);
            }
        }

        return buffer.ToArray();
    }

    /// <summary>A detached CMS signature, with the WWDR intermediate in the chain so Wallet can walk it to Apple's root.</summary>
    public static byte[] Sign(byte[] manifest, ApplePassSigner signer)
    {
        var cms = new SignedCms(new ContentInfo(manifest), detached: true);
        var cmsSigner = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, signer.Certificate)
        {
            DigestAlgorithm = new Oid("2.16.840.1.101.3.4.2.1"), // SHA-256
            IncludeOption = X509IncludeOption.EndCertOnly,
        };
        cmsSigner.Certificates.Add(signer.WwdrCertificate);
        cmsSigner.SignedAttributes.Add(new Pkcs9SigningTime());
        cms.ComputeSignature(cmsSigner);
        return cms.Encode();
    }

    private static object PassJson(PassContent c, ApplePassSigner signer)
    {
        var culture = CultureInfo.InvariantCulture;
        List<object> back = [];
        AddBackField(back, "address", "Address", c.RestaurantAddress);
        AddBackField(back, "phone", "Phone", c.RestaurantPhone);
        AddBackField(back, "requests", "Special requests", c.SpecialRequests);
        AddBackField(back, "manage", "Manage your booking", c.ManageUrl);

        List<object> auxiliary = [new { key = "ref", label = "REFERENCE", value = c.BookingRef }];
        if (!string.IsNullOrWhiteSpace(c.GuestName))
        {
            auxiliary.Add(new { key = "name", label = "NAME", value = c.GuestName });
        }

        return new
        {
            formatVersion = 1,
            passTypeIdentifier = signer.PassTypeIdentifier,
            teamIdentifier = signer.TeamIdentifier,
            serialNumber = c.SerialNumber,
            organizationName = c.OrganizationName,
            description = c.Description,
            relevantDate = c.Starts.ToString("yyyy-MM-dd'T'HH:mm:ssK", culture),
            expirationDate = c.Ends.AddHours(12).ToString("yyyy-MM-dd'T'HH:mm:ssK", culture),
            backgroundColor = Rgb(c.BackgroundHex),
            foregroundColor = "rgb(255, 255, 255)",
            labelColor = "rgb(255, 255, 255)",
            barcodes = new[]
            {
                new { format = "PKBarcodeFormatQR", message = c.ManageUrl, messageEncoding = "iso-8859-1", altText = c.BookingRef },
            },
            generic = new
            {
                headerFields = new[] { new { key = "time", label = "TIME", value = c.Starts.ToString("h:mm tt", culture) } },
                primaryFields = new[] { new { key = "restaurant", label = "RESERVATION", value = c.RestaurantName } },
                secondaryFields = new object[]
                {
                    new { key = "date", label = "DATE", value = c.Starts.ToString("ddd d MMM yyyy", culture) },
                    new { key = "party", label = "GUESTS", value = c.Seats.ToString(culture) },
                },
                auxiliaryFields = auxiliary,
                backFields = back,
            },
        };
    }

    private static void AddBackField(List<object> fields, string key, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            fields.Add(new { key, label, value });
        }
    }

    /// <summary>pass.json colours are <c>rgb(r, g, b)</c>, never hex.</summary>
    /// <seealso>ApplePassBuilderTests.Rgb_ConvertsSixAndThreeDigitHex</seealso>
    public static string Rgb(string hex)
    {
        string h = hex.TrimStart('#');
        if (h.Length == 3)
        {
            h = string.Concat(h[0], h[0], h[1], h[1], h[2], h[2]);
        }

        if (h.Length != 6 || !int.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out int rgb))
        {
            return "rgb(10, 126, 164)";
        }

        return $"rgb({(rgb >> 16) & 0xFF}, {(rgb >> 8) & 0xFF}, {rgb & 0xFF})";
    }
}
