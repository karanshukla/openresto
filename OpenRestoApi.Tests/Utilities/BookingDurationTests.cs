using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class BookingDurationTests
{
    private static readonly DateTime Start = new(2026, 8, 23, 18, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ResolveEnd_UsesStoredEndTime()
    {
        DateTime stored = Start.AddMinutes(150);

        Assert.Equal(stored, BookingDuration.ResolveEnd(Start, stored, 90));
    }

    [Fact]
    public void ResolveEnd_FallsBackToRestaurantDefaultWhenNull()
    {
        Assert.Equal(Start.AddMinutes(90), BookingDuration.ResolveEnd(Start, null, 90));
    }

    [Fact]
    public void ResolveEnd_FallsBackWhenStoredEndIsNotAfterStart()
    {
        Assert.Equal(Start.AddMinutes(90), BookingDuration.ResolveEnd(Start, Start, 90));
    }

    [Fact]
    public void ResolveEnd_UsesFallbackMinutesWhenLocationHasNoDefault()
    {
        Assert.Equal(
            Start.AddMinutes(BookingDuration.FallbackMinutes),
            BookingDuration.ResolveEnd(Start, null, null));
    }
}
