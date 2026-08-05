using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// The scheme allow-list here is a security gate, not a formatting nicety: <c>Uri.TryCreate</c>
/// parses <c>javascript:alert(1)</c> as a perfectly valid absolute URI, so only the allow-list
/// check stops it reaching an <c>href</c> in a social link or highlight.
/// </summary>
public class UrlValidatorTests
{
    [Theory]
    [InlineData("http://example.com")]
    [InlineData("https://example.com/menu.pdf")]
    [InlineData("HTTPS://EXAMPLE.COM")]
    public void IsValid_AcceptsWebSchemes(string url)
        => Assert.True(UrlValidator.IsValid(url, UrlValidator.WebSchemes));

    [Theory]
    [InlineData("mailto:hello@example.com")]
    [InlineData("tel:+442079460958")]
    [InlineData("sms:+442079460958")]
    public void IsValid_AcceptsContactSchemes_OnlyForTheWebAndContactSet(string url)
    {
        Assert.True(UrlValidator.IsValid(url, UrlValidator.WebAndContactSchemes));
        Assert.False(UrlValidator.IsValid(url, UrlValidator.WebSchemes));
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:text/html,<script>alert(1)</script>")]
    [InlineData("file:///etc/passwd")]
    public void IsValid_RejectsDangerousSchemes(string url)
    {
        Assert.False(UrlValidator.IsValid(url, UrlValidator.WebSchemes));
        Assert.False(UrlValidator.IsValid(url, UrlValidator.WebAndContactSchemes));
    }

    [Theory]
    [InlineData("/media/menu-1.pdf")]
    [InlineData("//example.com/path")]
    [InlineData("asdf")]
    [InlineData("example.com")]
    public void IsValid_RejectsAnythingThatIsNotAnAbsoluteUrl(string url)
        => Assert.False(UrlValidator.IsValid(url, UrlValidator.WebSchemes));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void IsValid_RejectsBlankInput(string? url)
        => Assert.False(UrlValidator.IsValid(url, UrlValidator.WebSchemes));

    [Fact]
    public void IsValid_TrimsBeforeParsing()
        => Assert.True(UrlValidator.IsValid("  https://example.com  ", UrlValidator.WebSchemes));
}
