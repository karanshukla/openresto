using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class TimezoneLogicTests
{
    [Fact]
    public void GetUtcRange_Toronto_ReturnsCorrectUTCRange()
    {
        // Admin navigates to April 18 (restaurant-local date).
        // Toronto is UTC-4 in April.
        // UTC Range for April 18 Toronto: April 18 04:00 UTC to April 19 04:00 UTC.
        // Input is Unspecified (as ASP.NET parses a date-only query param).
        DateTime refDate = new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Unspecified);
        string tz = "America/Toronto";

        (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 18, 4, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 4, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_Sydney_ReturnsCorrectUTCRange()
    {
        // Admin navigates to April 19 (restaurant-local date).
        // Sydney is UTC+10 in April.
        // UTC Range for April 19 Sydney: April 18 14:00 UTC to April 19 14:00 UTC.
        // Input is Unspecified (as ASP.NET parses a date-only query param).
        DateTime refDate = new DateTime(2026, 4, 19, 0, 0, 0, DateTimeKind.Unspecified);
        string tz = "Australia/Sydney";

        (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 18, 14, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 14, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_InvalidTz_DefaultsToUTC()
    {
        DateTime refDate = new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Unspecified);
        (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(refDate, "Invalid/Timezone");

        Assert.Equal(new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 0, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_Tokyo_ReturnsCorrectUTCRange()
    {
        // Admin navigates to April 18 (restaurant-local date).
        // Tokyo is UTC+9.
        // UTC Range for April 18 Tokyo: April 17 15:00 UTC to April 18 15:00 UTC.
        // Input is Unspecified (as ASP.NET parses a date-only query param).
        DateTime refDate = new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Unspecified);
        string tz = "Asia/Tokyo";

        (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 17, 15, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 18, 15, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_FromUtcInput_ShiftsToLocalCalendarDay()
    {
        // A UTC timestamp near midnight can land on a different calendar day in the
        // restaurant's timezone — the helper must use the local date, not the UTC date.
        // 2026-04-18T22:00 UTC → 2026-04-19T08:00 in Asia/Tokyo (UTC+9... +10 here is JST).
        // Tokyo in April is UTC+9, so 22:00 UTC → next-day 07:00 local → April 19 local day.
        DateTime utcRef = new DateTime(2026, 4, 18, 22, 0, 0, DateTimeKind.Utc);

        (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(utcRef, "Asia/Tokyo");

        Assert.Equal(new DateTime(2026, 4, 18, 15, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 15, 0, 0, DateTimeKind.Utc), end);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Resolve_EmptyOrNull_FallsBackToUtc(string? tzId)
    {
        Assert.Equal(TimeZoneInfo.Utc, TimeZoneHelper.Resolve(tzId));
    }

    [Fact]
    public void ConvertLocalToUtc_UnspecifiedKind_UsesRestaurantTimezone()
    {
        // 2026-04-18 19:00 local in Toronto (UTC-4) → 23:00 UTC
        DateTime local = new DateTime(2026, 4, 18, 19, 0, 0, DateTimeKind.Unspecified);

        DateTime utc = TimeZoneHelper.ConvertLocalToUtc(local, "America/Toronto");

        Assert.Equal(new DateTime(2026, 4, 18, 23, 0, 0, DateTimeKind.Utc), utc);
    }

    [Fact]
    public void ConvertLocalToUtc_UtcKind_PassesThrough()
    {
        DateTime alreadyUtc = new DateTime(2026, 4, 18, 23, 0, 0, DateTimeKind.Utc);

        DateTime result = TimeZoneHelper.ConvertLocalToUtc(alreadyUtc, "America/Toronto");

        Assert.Equal(alreadyUtc, result);
        Assert.Equal(DateTimeKind.Utc, result.Kind);
    }

    [Fact]
    public void ConvertUtcToLocal_RoundTripsWithConvertLocalToUtc()
    {
        DateTime originalLocal = new DateTime(2026, 4, 18, 19, 0, 0, DateTimeKind.Unspecified);
        string tz = "America/Toronto";

        DateTime utc = TimeZoneHelper.ConvertLocalToUtc(originalLocal, tz);
        DateTime backToLocal = TimeZoneHelper.ConvertUtcToLocal(utc, tz);

        Assert.Equal(originalLocal, backToLocal);
    }
}
