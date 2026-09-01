using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

/// <summary>
/// The version shape both the client header and the admin's minimum-version field are held to.
/// The pair matters: loosening this would let <c>1.9</c> or <c>v1.9.0</c> through on one side and
/// silently stop matching on the other.
/// </summary>
public class NativeAppVersionTests
{
    [Theory]
    [InlineData("1.9.0")]
    [InlineData("0.0.1")]
    [InlineData("10.20.30")]
    public void IsValid_AcceptsMajorMinorPatch(string version)
        => Assert.True(NativeAppVersion.IsValid(version));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1.9")]
    [InlineData("1.9.0.1")]
    [InlineData("v1.9.0")]
    [InlineData("1.9.0-beta")]
    [InlineData(" 1.9.0")]
    [InlineData("one.nine.zero")]
    public void IsValid_RejectsAnythingElse(string? version)
        => Assert.False(NativeAppVersion.IsValid(version));

    [Fact]
    public void IsValid_RejectsAVersionLongerThanTheColumn()
        => Assert.False(NativeAppVersion.IsValid(new string('1', NativeAppVersion.MaxLength) + ".0.0"));
}
