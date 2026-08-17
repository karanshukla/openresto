using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// The rule that decides what an audit entry is never allowed to carry. Each pair here is a
/// boundary: one field just inside the protected set and one just outside it, so the day someone
/// widens or narrows the fragment list, the test that fails says which direction it moved.
/// </summary>
public class AuditFieldsTests
{
    [Theory]
    [InlineData("password")]
    [InlineData("Password")]
    [InlineData("smtpPassword")]
    [InlineData("PasswordHash")]
    [InlineData("passwordSalt")]
    [InlineData("resetToken")]
    [InlineData("apiKey")]
    [InlineData("api_key")]
    [InlineData("clientSecret")]
    [InlineData("pvqQuestion")]
    [InlineData("pvqAnswerHash")]
    [InlineData("p256dh")]
    [InlineData("jwt")]
    public void Redact_MasksCredentialFields(string field)
    {
        Assert.True(AuditFields.IsProtected(field));
        Assert.Equal(AuditFields.RedactedMarker, AuditFields.Redact(field, "hunter2"));
    }

    /// <summary>
    /// Booking history is deliberately GDPR-purgeable, so an entry holding a customer's name,
    /// address or number would re-create exactly what the purge just deleted.
    /// </summary>
    [Theory]
    [InlineData("customerName")]
    [InlineData("customer_name")]
    [InlineData("CustomerEmail")]
    [InlineData("customerPhone")]
    [InlineData("guestName")]
    public void Redact_MasksCustomerIdentityFields(string field)
    {
        Assert.True(AuditFields.IsProtected(field));
        Assert.Equal(AuditFields.RedactedMarker, AuditFields.Redact(field, "jane@example.com"));
    }

    [Theory]
    [InlineData("seats")]
    [InlineData("bookingRef")]
    [InlineData("role")]
    [InlineData("isActive")]
    [InlineData("host")]
    [InlineData("port")]
    [InlineData("timezone")]
    public void Redact_LeavesOrdinaryFieldsIntact(string field)
    {
        Assert.False(AuditFields.IsProtected(field));
        Assert.Equal("4", AuditFields.Redact(field, 4));
    }

    [Fact]
    public void IsProtected_IgnoresSpacingInFieldNames()
    {
        Assert.True(AuditFields.IsProtected("customer name"));
    }

    [Fact]
    public void IsProtected_IsFalseForBlankNames()
    {
        Assert.False(AuditFields.IsProtected(""));
        Assert.False(AuditFields.IsProtected("   "));
    }

    [Fact]
    public void Redact_KeepsNullDistinctFromEmpty_SoUnsetToSetReadsCorrectly()
    {
        Assert.Null(AuditFields.Redact("address", null));
        Assert.Equal("", AuditFields.Redact("address", ""));
    }

    [Fact]
    public void Redact_WritesBooleansAndDatesInvariantly()
    {
        Assert.Equal("true", AuditFields.Redact("isArchived", true));
        Assert.Equal("false", AuditFields.Redact("isArchived", false));

        var when = new DateTime(2026, 3, 4, 5, 6, 7, DateTimeKind.Utc);
        Assert.StartsWith("2026-03-04T05:06:07", AuditFields.Redact("occurredAt", when), StringComparison.Ordinal);
    }

    [Fact]
    public void Sanitize_ClipsToTheColumnCap()
    {
        string value = new('x', AuditFields.MaxUserAgentLength + 50);

        Assert.Equal(AuditFields.MaxUserAgentLength, AuditFields.Sanitize(value, AuditFields.MaxUserAgentLength)!.Length);
    }

    [Fact]
    public void Sanitize_LeavesShorterValuesAndNullsAlone()
    {
        Assert.Equal("short", AuditFields.Sanitize("short", 100));
        Assert.Null(AuditFields.Sanitize(null, 100));
        Assert.Equal("", AuditFields.Sanitize("", 100));
    }

    /// <summary>
    /// Kestrel percent-decodes <c>%0A</c> straight into <c>Request.Path</c>, and the path, the
    /// user agent and a rejected sign-in's attempted address all reach an entry unfiltered. A
    /// newline left in one forges a line break in the log and renders in the trail as a second,
    /// convincing row — aimed squarely at the person reading the record to find out what happened.
    /// </summary>
    [Theory]
    [InlineData("/api/admin/x\nPOST /api/admin/y", "/api/admin/x POST /api/admin/y")]
    [InlineData("/api/admin/x\r\nfake", "/api/admin/x  fake")]
    [InlineData("agent\tname", "agent name")]
    [InlineData("nul\0byte", "nul byte")]
    public void Sanitize_StripsControlCharactersThatWouldForgeALine(string value, string expected)
        => Assert.Equal(expected, AuditFields.Sanitize(value, 512));

    [Fact]
    public void Sanitize_LeavesOrdinaryPunctuationAndUnicodeAlone()
        => Assert.Equal(
            "Mozilla/5.0 (Macintosh) — Café",
            AuditFields.Sanitize("Mozilla/5.0 (Macintosh) — Café", 512));
}
