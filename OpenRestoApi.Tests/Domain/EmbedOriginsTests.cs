using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class EmbedOriginsTests
{
    [Theory]
    [InlineData("https://bistro.example", "https://bistro.example")]
    [InlineData("  HTTPS://Bistro.Example/  ", "https://bistro.example")]
    [InlineData("https://bistro.example:443", "https://bistro.example")]
    [InlineData("http://localhost:4321", "http://localhost:4321")]
    [InlineData("http://127.0.0.1:8080", "http://127.0.0.1:8080")]
    [InlineData("http://[::1]:8080", "http://[::1]:8080")]
    [InlineData("https://Café.example", "https://xn--caf-dma.example")]
    public void TryNormalize_AcceptsAnOriginAndCanonicalisesIt(string value, string expected)
    {
        Assert.True(EmbedOrigins.TryNormalize(value, out string origin));
        Assert.Equal(expected, origin);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("bistro.example")]
    [InlineData("https://bistro.example/book")]
    [InlineData("https://bistro.example?x=1")]
    [InlineData("https://bistro.example#top")]
    [InlineData("https://user:pass@bistro.example")]
    [InlineData("https://*.bistro.example")]
    [InlineData("ftp://bistro.example")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://bistro.example; script-src *")]
    public void TryNormalize_RefusesWhatIsNotAnOrigin(string? value)
    {
        Assert.False(EmbedOrigins.TryNormalize(value, out _));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void FrameAncestors_RefusesEveryoneWhenNothingIsListed(string? stored)
    {
        Assert.Equal("'none'", EmbedOrigins.FrameAncestors(stored));
    }

    [Fact]
    public void FrameAncestors_ListsTheStoredOrigins()
    {
        Assert.Equal("https://a.example https://b.example",
            EmbedOrigins.FrameAncestors("https://a.example https://b.example"));
    }
}
