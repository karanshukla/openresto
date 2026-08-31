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
    public void Generate_ReturnsThreeWordsAndAFixedWidthNumericTail()
    {
        for (int i = 0; i < 200; i++)
        {
            string[] parts = BookingRefGenerator.Generate().Split('-');

            Assert.Equal(4, parts.Length);
            Assert.All(parts[..3], word => Assert.All(word, c => Assert.True(char.IsAsciiLetterLower(c))));
            Assert.Equal(BookingRefGenerator.TailDigits, parts[3].Length);
            Assert.All(parts[3], c => Assert.True(char.IsAsciiDigit(c)));
        }
    }

    [Fact]
    public void CombinationCount_MatchesTheDocumentedSpace()
    {
        // The figure quoted on BookingRefGenerator's doc comment, and the thing the security
        // argument for the format rests on. Editing a word list moves this and fails here, so the
        // comment cannot quietly become a lie.
        Assert.Equal(1_770_000_000L, BookingRefGenerator.CombinationCount);
    }

    [Fact]
    public void CombinationCount_IsWiderThanTheDigitsOnlyFormat()
    {
        // The default must be the wider of the two shapes: a restaurant that has not chosen a
        // format should not be the one with the shorter secret.
        long numericSpace = 9L * (long)Math.Pow(10, NumericBookingRefGenerator.Digits - 1);

        Assert.True(BookingRefGenerator.CombinationCount > numericSpace);
    }

    [Fact]
    public void Generate_TailSpansTheWholeRangeIncludingLeadingZeros()
    {
        // Both edges of the tail's range are reachable: it is zero-padded rather than
        // leading-digit-constrained, so 10^TailDigits values are in play, not 9 x 10^(n-1).
        var tails = new HashSet<int>();
        for (int i = 0; i < 20_000; i++)
        {
            tails.Add(int.Parse(BookingRefGenerator.Generate().Split('-')[3], System.Globalization.CultureInfo.InvariantCulture));
        }

        Assert.Contains(tails, t => t < 1000);
        Assert.Contains(tails, t => t >= 9000);
        Assert.True(tails.Count > 5000, $"Expected a wide spread of tails but saw {tails.Count} distinct values.");
    }

    [Fact]
    public void Generate_MultipleCallsProduceDifferentRefs()
    {
        var refs = new HashSet<string>();
        for (int i = 0; i < 500; i++)
        {
            refs.Add(BookingRefGenerator.Generate());
        }

        Assert.True(refs.Count >= 499, $"Expected 500 distinct refs but got {refs.Count}.");
    }

    [Fact]
    public void Generate_ThirdWordDiffersFromSecond()
    {
        for (int i = 0; i < 100; i++)
        {
            string[] parts = BookingRefGenerator.Generate().Split('-');

            Assert.NotEqual(parts[1], parts[2]);
        }
    }
}
