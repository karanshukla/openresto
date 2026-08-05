using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// Direct tests for the shared contact-field normalization used by both the per-location
/// (<c>Restaurant</c>) and global (<c>BrandSettings</c>) contact fields. The blank-clears and
/// trim conventions are the reason a location can drop its own phone and fall back to the brand
/// default, so they're pinned here rather than only through the two services.
/// </summary>
public class ContactFieldsTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void NormalizePhone_ReturnsNull_ForBlankInput(string input)
        => Assert.Null(ContactFields.NormalizePhone(input));

    [Fact]
    public void NormalizePhone_TrimsSurroundingWhitespace()
        => Assert.Equal("+44 20 7946 0958", ContactFields.NormalizePhone("  +44 20 7946 0958  "));

    [Fact]
    public void NormalizePhone_AcceptsAValueExactlyAtTheLimit()
    {
        string atLimit = new('9', ContactLimits.MaxPhoneLength);
        Assert.Equal(atLimit, ContactFields.NormalizePhone(atLimit));
    }

    [Fact]
    public void NormalizePhone_Throws_WhenLongerThanTheLimit()
    {
        string tooLong = new('9', ContactLimits.MaxPhoneLength + 1);

        ValidationException ex = Assert.Throws<ValidationException>(() => ContactFields.NormalizePhone(tooLong));

        Assert.Equal($"Phone number cannot exceed {ContactLimits.MaxPhoneLength} characters.", ex.Message);
    }

    [Fact]
    public void NormalizePhone_MeasuresTheLimitAfterTrimming()
    {
        // Padding must not push an otherwise-valid number over the limit.
        string atLimit = new('9', ContactLimits.MaxPhoneLength);
        Assert.Equal(atLimit, ContactFields.NormalizePhone($"   {atLimit}   "));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void NormalizeEmail_ReturnsNull_ForBlankInput(string input)
        => Assert.Null(ContactFields.NormalizeEmail(input));

    [Fact]
    public void NormalizeEmail_TrimsSurroundingWhitespace()
        => Assert.Equal("hello@example.com", ContactFields.NormalizeEmail("  hello@example.com  "));

    [Fact]
    public void NormalizeEmail_Throws_WhenLongerThanTheLimit()
    {
        // Kept a valid shape so this fails on length, not on the shape check below it.
        string local = new('a', ContactLimits.MaxEmailLength);
        string tooLong = $"{local}@example.com";

        ValidationException ex = Assert.Throws<ValidationException>(() => ContactFields.NormalizeEmail(tooLong));

        Assert.Equal($"Email address cannot exceed {ContactLimits.MaxEmailLength} characters.", ex.Message);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing@domain")]
    [InlineData("@example.com")]
    public void NormalizeEmail_Throws_ForAMalformedAddress(string input)
    {
        ValidationException ex = Assert.Throws<ValidationException>(() => ContactFields.NormalizeEmail(input));

        Assert.Equal("Email address must be a valid email address.", ex.Message);
    }
}
