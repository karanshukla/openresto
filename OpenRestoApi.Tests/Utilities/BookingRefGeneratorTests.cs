using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Utilities;

public class BookingRefGeneratorTests
{
    [Fact]
    public void Generate_ReturnsNonEmptyString()
    {
        string result = BookingRefGenerator.Generate();

        Assert.False(string.IsNullOrWhiteSpace(result));
    }

    [Fact]
    public void Generate_ReturnsThreeWordFormat()
    {
        string result = BookingRefGenerator.Generate();

        string[] parts = result.Split('-');
        Assert.Equal(3, parts.Length);
        Assert.All(parts, part => Assert.False(string.IsNullOrWhiteSpace(part)));
    }

    [Fact]
    public void Generate_MultipleCallsProduceDifferentRefs()
    {
        var refs = new HashSet<string>();
        for (int i = 0; i < 50; i++)
        {
            refs.Add(BookingRefGenerator.Generate());
        }

        // With 20 adjectives * 30 foods * 29 foods = 17,400 combinations,
        // 50 calls should produce at least 40 unique refs
        Assert.True(refs.Count >= 40, $"Expected at least 40 unique refs but got {refs.Count}");
    }

    [Fact]
    public void Generate_ThirdWordDiffersFromSecond()
    {
        // The generator ensures food2 != food1
        for (int i = 0; i < 20; i++)
        {
            string result = BookingRefGenerator.Generate();
            string[] parts = result.Split('-');
            Assert.NotEqual(parts[1], parts[2]);
        }
    }
}
