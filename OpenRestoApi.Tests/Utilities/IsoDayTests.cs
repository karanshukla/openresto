using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class IsoDayTests
{
    [Fact]
    public void Of_MapsSundayToSeven_RatherThanZero()
    {
        var sunday = new DateTime(2026, 1, 4, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal(7, IsoDay.Of(sunday));
    }

    [Fact]
    public void Of_MapsMondayToOne()
    {
        var monday = new DateTime(2026, 1, 5, 12, 0, 0, DateTimeKind.Utc);
        Assert.Equal(1, IsoDay.Of(monday));
    }

    // The availability feed and Restaurant.IsOpenAt read the same OpenDays column. These two
    // pin the boundary between what the parser accepts and what it drops, so a value one path
    // reads as Monday can no longer be a value the other silently discards.

    [Fact]
    public void ParseList_ReadsDayNamesAndNumbers()
    {
        HashSet<int> days = IsoDay.ParseList("mon, Tuesday, 3, sun");

        Assert.Equal(new HashSet<int> { 1, 2, 3, 7 }, days);
    }

    [Fact]
    public void ParseList_DiscardsUnrecognisedEntries()
    {
        HashSet<int> days = IsoDay.ParseList("1, 0, 8, funday, ");

        Assert.Equal(new HashSet<int> { 1 }, days);
    }

    [Fact]
    public void ParseList_ReturnsEmpty_ForBlankInput()
    {
        Assert.Empty(IsoDay.ParseList(null));
        Assert.Empty(IsoDay.ParseList("   "));
    }
}
