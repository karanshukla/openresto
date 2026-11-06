using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Domain;

public class DateExceptionsTests
{
    private static Restaurant NewRestaurant(string? json) => new() { Id = 1, Name = "T", DateExceptionsJson = json };

    [Fact]
    public void Parse_ReadsEveryTypeInDateOrder()
    {
        List<DateException> parsed = DateExceptions.Parse(
            """[{"date":"2026-12-31","type":"specialHours","open":"18:00","close":"01:00","lastBooking":"23:00"},{"date":"2026-12-24","type":"walkInOnly"},{"date":"2026-12-25","type":"closed"}]""");

        Assert.Equal(["2026-12-24", "2026-12-25", "2026-12-31"], parsed.Select(e => e.Date));
        Assert.Equal(
            [DateExceptionType.WalkInOnly, DateExceptionType.Closed, DateExceptionType.SpecialHours],
            parsed.Select(e => e.Kind));
        Assert.Equal("23:00", parsed[2].LastBooking);
    }

    [Fact]
    public void Parse_DropsEntriesWithAnUnknownTypeOrDate()
    {
        List<DateException> parsed = DateExceptions.Parse(
            """[{"date":"2026-12-25","type":"holiday"},{"date":"25/12/2026","type":"closed"},{"date":"2026-12-26","type":"closed"}]""");

        Assert.Single(parsed);
        Assert.Equal("2026-12-26", parsed[0].Date);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{\"date\":\"2026-12-25\"}")]
    public void Parse_IsEmptyForNothingUsable(string? json)
    {
        Assert.Empty(DateExceptions.Parse(json));
    }

    [Fact]
    public void Serialize_RoundTripsThroughParse_AndIsNullForAnEmptyList()
    {
        var entries = new List<DateException>
        {
            new() { Date = "2026-12-31", Type = "specialHours", Open = "18:00", Close = "01:00" },
            new() { Date = "2026-12-25", Type = "closed" },
        };

        string? json = DateExceptions.Serialize(entries);
        List<DateException> parsed = DateExceptions.Parse(json);

        Assert.Equal(["2026-12-25", "2026-12-31"], parsed.Select(e => e.Date));
        Assert.DoesNotContain("lastBooking", json);
        Assert.Null(DateExceptions.Serialize([]));
    }

    [Fact]
    public void For_FindsTheEntryOnItsDate()
    {
        Restaurant r = NewRestaurant("""[{"date":"2026-12-25","type":"closed"}]""");

        DateException? found = DateExceptions.For(r, new DateTime(2026, 12, 25, 19, 30, 0));

        Assert.NotNull(found);
        Assert.Equal(DateExceptionType.Closed, found.Kind);
    }

    [Fact]
    public void For_IsNullOnTheDayAfter()
    {
        Restaurant r = NewRestaurant("""[{"date":"2026-12-25","type":"closed"}]""");

        Assert.Null(DateExceptions.For(r, new DateTime(2026, 12, 26)));
    }
}
