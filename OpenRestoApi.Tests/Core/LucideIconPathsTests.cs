using OpenRestoApi.Core.Application;

namespace OpenRestoApi.Tests.Core;

public class LucideIconPathsTests
{
    [Theory]
    [InlineData("utensils")]
    [InlineData("wine")]
    [InlineData("coffee")]
    [InlineData("pizza")]
    [InlineData("flame")]
    [InlineData("leaf")]
    [InlineData("star")]
    [InlineData("heart")]
    [InlineData("chef-hat")]
    [InlineData("fish")]
    [InlineData("hamburger")]
    [InlineData("sandwich")]
    [InlineData("soup")]
    [InlineData("cake")]
    [InlineData("ice-cream-cone")]
    public void Get_KnownIcon_ReturnsSvgPath(string icon)
    {
        string? result = LucideIconPaths.Get(icon);
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }

    [Fact]
    public void Get_UnknownIcon_ReturnsNull()
    {
        Assert.Null(LucideIconPaths.Get("not-an-icon"));
        Assert.Null(LucideIconPaths.Get(""));
        Assert.Null(LucideIconPaths.Get("burger"));
    }

    [Theory]
    [InlineData("UTENSILS")]
    [InlineData("Wine")]
    [InlineData("CHEF-HAT")]
    [InlineData("Fish")]
    public void Get_IsCaseInsensitive(string icon)
    {
        Assert.NotNull(LucideIconPaths.Get(icon));
    }
}
