using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace OpenRestoApi.Infrastructure.Wallet;

/// <summary>The service account a Google Wallet JWT is signed by. Loaded once from <c>WalletSettings</c> by the caller.</summary>
public sealed record GoogleWalletIssuer(string IssuerId, string ServiceAccountEmail, RSA PrivateKey);

/// <summary>
/// Builds a "Save to Google Wallet" link: a generic pass object (and its class, inlined so no
/// prior API call has to have created it) inside an RS256 JWT signed by the issuer's service
/// account, appended to Google's save URL. Nothing is stored on Google's side until the guest taps
/// the link, which is why the object carries everything and the id is deterministic per booking.
/// </summary>
/// <seealso>GoogleWalletLinkBuilderTests.Build_ProducesASaveUrlWhoseJwtVerifiesWithTheIssuerKey</seealso>
/// <seealso>GoogleWalletLinkBuilderTests.Build_NamesTheIssuerClassAndObjectDeterministically</seealso>
/// <seealso>GoogleWalletLinkBuilderTests.Build_OmitsTheLogoWithoutAPublicIcon</seealso>
public static class GoogleWalletLinkBuilder
{
    public const string SaveUrlBase = "https://pay.google.com/gp/v/save/";
    public const string ClassSuffix = "openresto-booking";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string Build(PassContent content, GoogleWalletIssuer issuer, string origin, string? logoUrl, DateTimeOffset issuedAt)
    {
        string classId = $"{issuer.IssuerId}.{ClassSuffix}";
        string objectId = $"{issuer.IssuerId}.{Sanitize(content.SerialNumber)}";

        var payload = new
        {
            iss = issuer.ServiceAccountEmail,
            aud = "google",
            typ = "savetowallet",
            iat = issuedAt.ToUnixTimeSeconds(),
            origins = new[] { origin },
            payload = new
            {
                genericClasses = new[] { new { id = classId } },
                genericObjects = new[] { GenericObject(content, classId, objectId, logoUrl) },
            },
        };

        string header = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new { alg = "RS256", typ = "JWT" }));
        string body = Base64Url(JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions));
        byte[] signature = issuer.PrivateKey.SignData(
            Encoding.ASCII.GetBytes($"{header}.{body}"), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        return $"{SaveUrlBase}{header}.{body}.{Base64Url(signature)}";
    }

    private static object GenericObject(PassContent c, string classId, string objectId, string? logoUrl)
    {
        List<object> modules =
        [
            new { id = "date", header = "Date", body = c.Starts.ToString("ddd d MMM yyyy", System.Globalization.CultureInfo.InvariantCulture) },
            new { id = "time", header = "Time", body = c.Starts.ToString("h:mm tt", System.Globalization.CultureInfo.InvariantCulture) },
            new { id = "guests", header = "Guests", body = c.Seats.ToString(System.Globalization.CultureInfo.InvariantCulture) },
            new { id = "ref", header = "Reference", body = c.BookingRef },
        ];
        if (!string.IsNullOrWhiteSpace(c.RestaurantAddress))
        {
            modules.Add(new { id = "address", header = "Address", body = c.RestaurantAddress });
        }

        return new
        {
            id = objectId,
            classId,
            state = "ACTIVE",
            cardTitle = Localized(c.OrganizationName),
            header = Localized(c.RestaurantName),
            subheader = Localized(c.Description),
            hexBackgroundColor = c.BackgroundHex,
            logo = logoUrl is null ? null : new { sourceUri = new { uri = logoUrl }, contentDescription = Localized(c.OrganizationName) },
            barcode = new { type = "QR_CODE", value = c.ManageUrl, alternateText = c.BookingRef },
            validTimeInterval = new
            {
                start = new { date = c.Starts.ToString("o") },
                end = new { date = c.Ends.AddHours(12).ToString("o") },
            },
            textModulesData = modules,
            linksModuleData = new
            {
                uris = new[] { new { id = "manage", uri = c.ManageUrl, description = "Manage your booking" } },
            },
        };
    }

    private static object Localized(string value) => new { defaultValue = new { language = "en", value } };

    /// <summary>Object ids allow only <c>[A-Za-z0-9._-]</c> after the issuer prefix.</summary>
    private static string Sanitize(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (char ch in value)
        {
            sb.Append(char.IsAsciiLetterOrDigit(ch) || ch is '.' or '_' or '-' ? ch : '-');
        }

        return sb.ToString();
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
