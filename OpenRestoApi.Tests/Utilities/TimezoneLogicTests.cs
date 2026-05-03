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
        // April 18, 2026 at 10:00 AM UTC
        // Toronto is UTC-4 in April. 
        // Local time is 06:00 AM. 
        // Today (local) is April 18.
        // UTC Range should be April 18 04:00 UTC to April 19 04:00 UTC.
        DateTime refDate = new DateTime(2026, 4, 18, 10, 0, 0, DateTimeKind.Utc);
        string tz = "America/Toronto";

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 18, 4, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 4, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_Sydney_ReturnsCorrectUTCRange()
    {
        // April 18, 2026 at 20:00 (8 PM) UTC
        // Sydney is UTC+10 (Standard) or +11 (DST). In April it's +10.
        // Local time: April 19, 06:00 AM.
        // Today (local) is April 19.
        // UTC Range should be April 18 14:00 UTC to April 19 14:00 UTC.
        DateTime refDate = new DateTime(2026, 4, 18, 20, 0, 0, DateTimeKind.Utc);
        string tz = "AUS Eastern Standard Time"; // Windows ID for Sydney

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

        // Sydney (UTC+10) Day start (00:00) is 14:00 previous day UTC
        Assert.Equal(new DateTime(2026, 4, 18, 14, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 14, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_InvalidTz_DefaultsToUTC()
    {
        DateTime refDate = new DateTime(2026, 4, 18, 10, 0, 0, DateTimeKind.Utc);
        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, "Invalid/Timezone");

        Assert.Equal(new DateTime(2026, 4, 18, 0, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 19, 0, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void GetUtcRange_Tokyo_ReturnsCorrectUTCRange()
    {
        // April 18, 2026 at 10:00 AM UTC
        // Tokyo is UTC+9. 
        // Local time is 19:00 (7 PM). 
        // Today (local) is April 18.
        // UTC Range should be April 17 15:00 UTC to April 18 15:00 UTC.
        DateTime refDate = new DateTime(2026, 4, 18, 10, 0, 0, DateTimeKind.Utc);
        string tz = "Tokyo Standard Time";

        (DateTime start, DateTime end) = InvokeGetUtcRange(refDate, tz);

        Assert.Equal(new DateTime(2026, 4, 17, 15, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 4, 18, 15, 0, 0, DateTimeKind.Utc), end);
    }
}
