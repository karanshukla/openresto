using System.Reflection;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Tests.Utilities;

public class TimezoneLogicTests
{
    private static (DateTime Start, DateTime End) InvokeGetUtcRange(DateTime reference, string tzId)
    {
        // Accessing the private static method via reflection for precise unit testing
        MethodInfo? method = typeof(AdminService).GetMethod("GetUtcRangeForLocalDay",
            BindingFlags.NonPublic | BindingFlags.Static);
        return ((DateTime, DateTime))method!.Invoke(null, [reference, tzId])!;
    }

    [Fact]
    public void GetUtcRange_Toronto_ReturnsCorrectUTCRange()
    {
        // Admin navigates to April 18 (restaurant-local date).
        // Toronto is UTC-4 in April.
        // UTC Range for April 18 Toronto: April 18 04:00 UTC to April 19 04:00 UTC.
        // Input is Unspecified (as ASP.NET parses a date-only query param).
        DateTime refDate = new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Unspecified);
        string tz = "America/Toronto";

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

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

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 18, 14, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 14, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_InvalidTz_DefaultsToUTC()
    {
        DateTime refDate = new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Unspecified);
        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, "Invalid/Timezone");

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

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 17, 15, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 18, 15, 0, 0, DateTimeKind.Utc), end);
    }
}
