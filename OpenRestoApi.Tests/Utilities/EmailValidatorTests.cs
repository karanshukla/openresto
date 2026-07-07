using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class EmailValidatorTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("john.doe@sub.example.co.uk")]
    [InlineData("a@b.co")]
    [InlineData("  trim-me@example.com  ")] // trimmed before matching
    [InlineData("Plus+Alias@example.com")]
    public void IsValid_AcceptsWellFormedEmails(string email)
    {
        Assert.True(EmailValidator.IsValid(email));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no-at-sign.com")]
    [InlineData("no-tld@example")]
    [InlineData("spaces @example.com")]
    [InlineData("@nouser.com")]
    [InlineData("nouser@.com")]
    public void IsValid_RejectsMalformedEmails(string? email)
    {
        Assert.False(EmailValidator.IsValid(email));
    }
}
