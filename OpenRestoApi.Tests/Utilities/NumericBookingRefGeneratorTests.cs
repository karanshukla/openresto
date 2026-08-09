using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Utilities;

public class NumericBookingRefGeneratorTests
{
    [Fact]
    public void Generate_ReturnsDigitsOnly()
    {
        for (int i = 0; i < 50; i++)
        {
            string result = NumericBookingRefGenerator.Generate();

            Assert.All(result, c => Assert.True(char.IsAsciiDigit(c), $"'{result}' contains a non-digit."));
        }
    }

    [Fact]
    public void Generate_ReturnsFixedLengthWithNoLeadingZero()
    {
        for (int i = 0; i < 100; i++)
        {
            string result = NumericBookingRefGenerator.Generate();

            Assert.Equal(NumericBookingRefGenerator.Digits, result.Length);
            Assert.NotEqual('0', result[0]);
        }
    }

    [Fact]
    public void Generate_MultipleCallsProduceDifferentRefs()
    {
        var refs = new HashSet<string>();
        for (int i = 0; i < 50; i++)
        {
            refs.Add(NumericBookingRefGenerator.Generate());
        }

        Assert.True(refs.Count >= 45, $"Expected at least 45 unique refs but got {refs.Count}");
    }
}

public class BookingRefFactoryTests
{
    [Fact]
    public void GenerateFor_Numeric_ReturnsDigitsOnly()
    {
        string result = BookingRefFactory.GenerateFor(BookingRefFormat.Numeric);

        Assert.All(result, c => Assert.True(char.IsAsciiDigit(c)));
    }

    [Fact]
    public void GenerateFor_AlphaNumeric_ReturnsThreeWordFormat()
    {
        string result = BookingRefFactory.GenerateFor(BookingRefFormat.AlphaNumeric);

        Assert.Equal(3, result.Split('-').Length);
    }

    [Fact]
    public void GenerateFor_UnknownFormat_FallsBackToWordFormat()
    {
        // Guards the switch's default arm: an int cast past the defined members must not
        // produce an empty reference.
        string result = BookingRefFactory.GenerateFor((BookingRefFormat)99);

        Assert.Equal(3, result.Split('-').Length);
    }

    [Fact]
    public void GenerateFor_Restaurant_UsesItsConfiguredFormat()
    {
        var numeric = new Restaurant { Name = "R", BookingRefFormat = BookingRefFormat.Numeric };
        var words = new Restaurant { Name = "R" };

        Assert.All(BookingRefFactory.GenerateFor(numeric), c => Assert.True(char.IsAsciiDigit(c)));
        Assert.Equal(3, BookingRefFactory.GenerateFor(words).Split('-').Length);
    }

    [Fact]
    public void Restaurant_DefaultsToAlphaNumeric()
    {
        Assert.Equal(BookingRefFormat.AlphaNumeric, new Restaurant { Name = "R" }.BookingRefFormat);
    }
}
