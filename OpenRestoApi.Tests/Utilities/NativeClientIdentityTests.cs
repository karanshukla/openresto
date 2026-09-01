using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// Both sides of the header's boundary. The header is unauthenticated caller input, so what it
/// rejects is as load-bearing as what it accepts: anything that got through would end up as a
/// row key in <c>NativeClientStats</c>.
/// </summary>
public class NativeClientIdentityTests
{
    [Theory]
    [InlineData("ios/1.9.0", "ios", "1.9.0")]
    [InlineData("android/1.9.0", "android", "1.9.0")]
    [InlineData("android/10.0.3", "android", "10.0.3")]
    public void TryParse_AcceptsIosAndAndroidWithASemanticVersion(string header, string expectedPlatform, string expectedVersion)
    {
        Assert.True(NativeClientIdentity.TryParse(header, out string platform, out string version));
        Assert.Equal(expectedPlatform, platform);
        Assert.Equal(expectedVersion, version);
    }

    [Theory]
    [InlineData("web/1.9.0")]
    [InlineData("iOS/1.9.0")]
    [InlineData("Android/1.9.0")]
    [InlineData("windows/1.9.0")]
    public void TryParse_RejectsAnUnknownPlatform(string header)
        => AssertIgnored(header);

    [Theory]
    [InlineData("ios/1.9")]
    [InlineData("ios/v1.9.0")]
    [InlineData("ios/1.9.0-rc1")]
    [InlineData("android/latest")]
    public void TryParse_RejectsAVersionThatIsNotMajorMinorPatch(string header)
        => AssertIgnored(header);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ios")]
    [InlineData("ios/")]
    [InlineData("/1.9.0")]
    [InlineData("ios 1.9.0")]
    public void TryParse_RejectsMalformedHeaders(string? header)
        => AssertIgnored(header);

    private static void AssertIgnored(string? header)
    {
        Assert.False(NativeClientIdentity.TryParse(header, out string platform, out string version));
        Assert.Equal(string.Empty, platform);
        Assert.Equal(string.Empty, version);
    }
}
