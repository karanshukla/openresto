using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Column caps and value coercion for audit entries, plus the one rule that decides what an
/// entry is never allowed to carry.
/// <para>
/// Two things keep secrets out of <c>ChangesJson</c>. First, changes are only ever written by a
/// service naming a field explicitly, so the set of recorded fields is an allow-list by
/// construction rather than a serialized request body. Second, <see cref="IsProtected"/> masks
/// the value even when a field is named — credentials because they are secrets, and customer
/// identity because booking history is deliberately GDPR-purgeable and an audit row holding a
/// customer's name, email or phone would re-create exactly what the purge just deleted.
/// </para>
/// <seealso>AuditFieldsTests.Redact_MasksCredentialFields</seealso>
/// <seealso>AuditFieldsTests.Redact_MasksCustomerIdentityFields</seealso>
/// <seealso>AuditFieldsTests.Redact_LeavesOrdinaryFieldsIntact</seealso>
/// </summary>
public static class AuditFields
{
    public const int MaxActorEmailLength = 320;
    public const int MaxActorDisplayNameLength = 100;
    public const int MaxRoleLength = 32;
    public const int MaxActionLength = 64;
    public const int MaxTargetTypeLength = 32;
    public const int MaxTargetIdLength = 64;
    public const int MaxTargetLabelLength = 128;
    public const int MaxSummaryLength = 256;
    public const int MaxChangesJsonLength = 4000;
    public const int MaxHttpMethodLength = 10;
    public const int MaxPathLength = 512;
    public const int MaxIpAddressLength = 64;
    public const int MaxUserAgentLength = 256;

    /// <summary>What a masked value reads as in the stored JSON and in the UI.</summary>
    public const string RedactedMarker = "[redacted]";

    /// <summary>
    /// Substrings that make a field name protected. Matched case-insensitively against the whole
    /// name, so <c>smtpPassword</c>, <c>PasswordHash</c> and <c>pvqAnswerSalt</c> all match
    /// without anyone having to enumerate them.
    /// </summary>
    private static readonly string[] ProtectedFragments =
    [
        "password", "secret", "token", "hash", "salt", "credential", "apikey", "api_key",
        "pvq", "answer", "p256dh", "jwt", "customername", "customer_name", "customeremail",
        "customer_email", "customerphone", "customer_phone", "guestname", "guest_name",
    ];

    /// <summary>True when a field's <em>value</em> must never be stored, only the fact it changed.</summary>
    public static bool IsProtected(string field)
    {
        if (string.IsNullOrWhiteSpace(field)) return false;
        string collapsed = field.Replace(" ", string.Empty, StringComparison.Ordinal);
        return ProtectedFragments.Any(f => collapsed.Contains(f, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// The value as it should be stored: <see cref="RedactedMarker"/> for a protected field,
    /// otherwise an invariant, round-trippable string. Null stays null so "unset → set" reads
    /// correctly in the diff.
    /// </summary>
    public static string? Redact(string field, object? value)
    {
        if (IsProtected(field)) return RedactedMarker;
        return Stringify(value);
    }

    private static string? Stringify(object? value) => value switch
    {
        null => null,
        string s => s,
        bool b => b ? "true" : "false",
        DateTime d => d.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };

    /// <summary>
    /// Everything an entry stores goes through here: control characters out, then clipped to the
    /// column's cap. Storing a truncated user agent beats storing none.
    /// <para>
    /// The stripping is the security-relevant half. An entry's path, user agent and — on a
    /// rejected sign-in — the attempted address are all supplied by the caller, and Kestrel
    /// percent-decodes <c>%0A</c> straight into <c>Request.Path</c>. Left alone, a newline
    /// renders in the trail as a convincing extra row: whoever is reading the record to find out
    /// what happened is exactly the person a forged entry is aimed at.
    /// </para>
    /// <seealso>AuditFieldsTests.Sanitize_StripsControlCharactersThatWouldForgeALine</seealso>
    /// <seealso>AuditFieldsTests.Sanitize_ClipsToTheColumnCap</seealso>
    /// </summary>
    public static string? Sanitize(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return value;

        string cleaned = value.Any(char.IsControl)
            ? new string([.. value.Select(c => char.IsControl(c) ? ' ' : c)])
            : value;

        return cleaned.Length <= maxLength ? cleaned : cleaned[..maxLength];
    }
}
