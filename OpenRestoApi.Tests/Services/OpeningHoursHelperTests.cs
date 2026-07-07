using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class OpeningHoursHelperTests
{
    private static Restaurant MakeRestaurant(string? openHoursJson = null) => new()
    {
        Id = 1,
        Name = "Test",
        OpenTime = "09:00",
        CloseTime = "22:00",
        OpenHoursJson = openHoursJson
    };

    [Fact]
    public void GetHoursForDay_FallsBackToUniformHours_WhenNoJson()
    {
        Restaurant r = MakeRestaurant();

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 3);

        Assert.Equal("09:00", open);
        Assert.Equal("22:00", close);
    }

    [Fact]
    public void GetHoursForDay_UsesOverride_ForConfiguredDay()
    {
        Restaurant r = MakeRestaurant("""{"6":{"open":"11:00","close":"23:30"}}""");

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 6);

        Assert.Equal("11:00", open);
        Assert.Equal("23:30", close);
    }

    [Fact]
    public void GetHoursForDay_FallsBack_ForDayWithoutOverride()
    {
        Restaurant r = MakeRestaurant("""{"6":{"open":"11:00","close":"23:30"}}""");

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 2);

        Assert.Equal("09:00", open);
        Assert.Equal("22:00", close);
    }

    [Fact]
    public void GetHoursForDay_FallsBack_WhenJsonMalformed()
    {
        Restaurant r = MakeRestaurant("not json at all");

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 1);

        Assert.Equal("09:00", open);
        Assert.Equal("22:00", close);
    }

    [Fact]
    public void GetHoursForDay_FallsBack_WhenOverrideTimesInvalid()
    {
        Restaurant r = MakeRestaurant("""{"1":{"open":"25:99","close":"aa:bb"}}""");

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 1);

        Assert.Equal("09:00", open);
        Assert.Equal("22:00", close);
    }

    [Fact]
    public void Parse_IgnoresOutOfRangeDayKeys()
    {
        var parsed = OpeningHoursHelper.Parse("""{"0":{"open":"01:00","close":"02:00"},"8":{"open":"01:00","close":"02:00"},"5":{"open":"10:00","close":"20:00"}}""");

        Assert.NotNull(parsed);
        Assert.Single(parsed);
        Assert.Equal("10:00", parsed[5].Open);
    }

    [Fact]
    public void Parse_ReturnsNull_ForEmptyOrWhitespace()
    {
        Assert.Null(OpeningHoursHelper.Parse(null));
        Assert.Null(OpeningHoursHelper.Parse(""));
        Assert.Null(OpeningHoursHelper.Parse("   "));
        Assert.Null(OpeningHoursHelper.Parse("{}"));
    }

    [Fact]
    public void ResolveWeek_Returns7ResolvedEntries()
    {
        Restaurant r = MakeRestaurant("""{"7":{"open":"12:00","close":"16:00"}}""");

        List<DayHoursDto> week = OpeningHoursHelper.ResolveWeek(r);

        Assert.Equal(7, week.Count);
        Assert.Equal(new[] { 1, 2, 3, 4, 5, 6, 7 }, week.Select(d => d.Day).ToArray());
        Assert.All(week.Where(d => d.Day != 7), d =>
        {
            Assert.Equal("09:00", d.Open);
            Assert.Equal("22:00", d.Close);
        });
        Assert.Equal("12:00", week.Single(d => d.Day == 7).Open);
        Assert.Equal("16:00", week.Single(d => d.Day == 7).Close);
    }

    [Fact]
    public void ApplyOpenHours_CollapsesToUniform_WhenAllDaysMatch()
    {
        Restaurant r = MakeRestaurant("""{"6":{"open":"11:00","close":"23:30"}}""");
        var uniform = Enumerable.Range(1, 7)
            .Select(d => new DayHoursDto { Day = d, Open = "10:00", Close = "20:00" })
            .ToList();

        OpeningHoursHelper.ApplyOpenHours(r, uniform);

        Assert.Null(r.OpenHoursJson);
        Assert.Equal("10:00", r.OpenTime);
        Assert.Equal("20:00", r.CloseTime);
    }

    [Fact]
    public void ApplyOpenHours_StoresJson_WhenDaysDiffer()
    {
        Restaurant r = MakeRestaurant();
        var hours = Enumerable.Range(1, 7)
            .Select(d => new DayHoursDto { Day = d, Open = "10:00", Close = "20:00" })
            .ToList();
        hours[5] = new DayHoursDto { Day = 6, Open = "11:00", Close = "23:00" };

        OpeningHoursHelper.ApplyOpenHours(r, hours);

        Assert.NotNull(r.OpenHoursJson);
        (string satOpen, string satClose) = OpeningHoursHelper.GetHoursForDay(r, 6);
        Assert.Equal("11:00", satOpen);
        Assert.Equal("23:00", satClose);
        (string monOpen, _) = OpeningHoursHelper.GetHoursForDay(r, 1);
        Assert.Equal("10:00", monOpen);
    }

    [Fact]
    public void ApplyOpenHours_NormalizesSingleDigitTimes()
    {
        Restaurant r = MakeRestaurant();
        var hours = new List<DayHoursDto>
        {
            new() { Day = 1, Open = "9:5", Close = "22:0" }
        };

        OpeningHoursHelper.ApplyOpenHours(r, hours);

        (string open, string close) = OpeningHoursHelper.GetHoursForDay(r, 1);
        Assert.Equal("09:05", open);
        Assert.Equal("22:00", close);
    }

    [Fact]
    public void ApplyOpenHours_PartialUpdate_KeepsExistingHoursForOtherDays()
    {
        Restaurant r = MakeRestaurant("""{"2":{"open":"08:00","close":"14:00"}}""");
        var hours = new List<DayHoursDto>
        {
            new() { Day = 6, Open = "11:00", Close = "23:00" }
        };

        OpeningHoursHelper.ApplyOpenHours(r, hours);

        (string tueOpen, string tueClose) = OpeningHoursHelper.GetHoursForDay(r, 2);
        Assert.Equal("08:00", tueOpen);
        Assert.Equal("14:00", tueClose);
        (string satOpen, _) = OpeningHoursHelper.GetHoursForDay(r, 6);
        Assert.Equal("11:00", satOpen);
        (string monOpen, _) = OpeningHoursHelper.GetHoursForDay(r, 1);
        Assert.Equal("09:00", monOpen);
    }

    [Fact]
    public void ApplyOpenHours_EmptyList_ClearsOverrides()
    {
        Restaurant r = MakeRestaurant("""{"6":{"open":"11:00","close":"23:30"}}""");

        OpeningHoursHelper.ApplyOpenHours(r, new List<DayHoursDto>());

        Assert.Null(r.OpenHoursJson);
        Assert.Equal("09:00", r.OpenTime);
        Assert.Equal("22:00", r.CloseTime);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    [InlineData(-1)]
    public void ApplyOpenHours_Throws_ForInvalidDay(int day)
    {
        Restaurant r = MakeRestaurant();
        var hours = new List<DayHoursDto> { new() { Day = day, Open = "09:00", Close = "22:00" } };

        Assert.Throws<ValidationException>(() => OpeningHoursHelper.ApplyOpenHours(r, hours));
    }

    [Fact]
    public void ApplyOpenHours_Throws_ForDuplicateDay()
    {
        Restaurant r = MakeRestaurant();
        var hours = new List<DayHoursDto>
        {
            new() { Day = 1, Open = "09:00", Close = "22:00" },
            new() { Day = 1, Open = "10:00", Close = "20:00" }
        };

        Assert.Throws<ValidationException>(() => OpeningHoursHelper.ApplyOpenHours(r, hours));
    }

    [Theory]
    [InlineData("24:00", "22:00")]
    [InlineData("09:60", "22:00")]
    [InlineData("nope", "22:00")]
    [InlineData("09:00", "")]
    [InlineData("09:00", "9")]
    public void ApplyOpenHours_Throws_ForInvalidTimes(string open, string close)
    {
        Restaurant r = MakeRestaurant();
        var hours = new List<DayHoursDto> { new() { Day = 1, Open = open, Close = close } };

        Assert.Throws<ValidationException>(() => OpeningHoursHelper.ApplyOpenHours(r, hours));
    }

    [Theory]
    [InlineData("09:00", true, 9, 0)]
    [InlineData("23:59", true, 23, 59)]
    [InlineData("00:00", true, 0, 0)]
    [InlineData("24:00", false, 0, 0)]
    [InlineData("12:60", false, 0, 0)]
    [InlineData("", false, 0, 0)]
    [InlineData("12", false, 0, 0)]
    public void TryParseTime_ValidatesRange(string input, bool expected, int h, int m)
    {
        bool ok = OpeningHoursHelper.TryParseTime(input, out int hour, out int minute);

        Assert.Equal(expected, ok);
        if (expected)
        {
            Assert.Equal(h, hour);
            Assert.Equal(m, minute);
        }
    }
}
