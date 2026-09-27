using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Format, hashing and verification for admin API keys (issue #319): <c>orst_&lt;id&gt;_&lt;secret&gt;</c>,
/// where <c>id</c> is the owning <c>AdminApiKey</c> row id (so a lookup can go straight to one row
/// instead of scanning every key's hash) and <c>secret</c> is 32 bytes of CSPRNG output,
/// base64url-encoded. The <c>orst_</c> prefix exists so a leaked key is matchable by a
/// secret-scanner.
/// <para>
/// Deliberately a single fast SHA-256, not <see cref="Interfaces.IPasswordService"/>'s PBKDF2: a
/// login password is low-entropy and must resist offline brute-force, so it is deliberately slow
/// to hash; a generated key already carries 256 bits of entropy and is verified on every request,
/// so a slow hash would only cost latency for no real security gain.
/// </para>
/// <para>
/// The hash covers the entire raw key string, not just the secret segment — the id contributes no
/// verification entropy either way, and hashing exactly what a caller pastes keeps generation and
/// verification working from one value instead of two.
/// </para>
/// </summary>
public static class ApiKeyCrypto
{
    public const string KeyPrefix = "orst_";
    private const int SecretBytes = 32;

    /// <summary>Length of the prefix stored for display, e.g. <c>orst_12_A1b2C3d4</c>.</summary>
    private const int DisplayPrefixLength = 16;

    /// <summary>
    /// Generates a new raw key for the given (already-persisted) row id.
    /// <seealso>ApiKeyCryptoTests.GenerateRawKey_ProducesAParsableKeyThatVerifiesAgainstItsOwnHash</seealso>
    /// </summary>
    public static string GenerateRawKey(int id)
    {
        string secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(SecretBytes))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"{KeyPrefix}{id.ToString(CultureInfo.InvariantCulture)}_{secret}";
    }

    /// <summary>SHA-256 hex digest of the raw key, lower-cased.</summary>
    public static string Hash(string rawKey)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawKey))).ToLowerInvariant();

    /// <summary>
    /// Constant-time comparison of a presented raw key against a stored hash — timing-safe so a
    /// key's validity can't be inferred from how quickly a mismatch is rejected.
    /// <seealso>ApiKeyCryptoTests.Verify_AcceptsTheExactKeyThatProducedTheHash</seealso>
    /// <seealso>ApiKeyCryptoTests.Verify_RejectsAKeyWithATamperedSecret</seealso>
    /// </summary>
    public static bool Verify(string rawKey, string storedHash)
        => CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Hash(rawKey)), Encoding.UTF8.GetBytes(storedHash));

    /// <summary>
    /// Pulls the row id out of the <c>orst_&lt;id&gt;_&lt;secret&gt;</c> shape without touching the
    /// secret — enough to narrow a lookup to one row before any hashing happens. Returns false for
    /// anything that isn't shaped like a key this scheme could have issued (wrong prefix, missing
    /// separator, non-numeric or non-positive id) rather than throwing, since the header is
    /// caller-supplied and malformed input is the expected failure mode, not an exceptional one.
    /// <seealso>ApiKeyCryptoTests.TryParseId_ExtractsTheIdFromAWellFormedKey</seealso>
    /// <seealso>ApiKeyCryptoTests.TryParseId_RejectsAKeyWithTheWrongPrefix</seealso>
    /// <seealso>ApiKeyCryptoTests.TryParseId_RejectsAKeyWithANonNumericId</seealso>
    /// <seealso>ApiKeyCryptoTests.TryParseId_RejectsAKeyWithNoSecretSegment</seealso>
    /// </summary>
    public static bool TryParseId(string? rawKey, out int id)
    {
        id = 0;
        if (string.IsNullOrEmpty(rawKey) || !rawKey.StartsWith(KeyPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        string rest = rawKey[KeyPrefix.Length..];
        int separator = rest.IndexOf('_');
        if (separator <= 0 || separator == rest.Length - 1)
        {
            return false;
        }

        return int.TryParse(rest[..separator], NumberStyles.None, CultureInfo.InvariantCulture, out id) && id > 0;
    }

    /// <summary>The non-secret prefix of a raw key, kept on the row for display in a key list.</summary>
    public static string DisplayPrefix(string rawKey)
        => rawKey.Length <= DisplayPrefixLength ? rawKey : rawKey[..DisplayPrefixLength];
}
