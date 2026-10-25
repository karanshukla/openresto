using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class LastBookingHelperTests
{
    [Fact]
    public void RejectionFor_NamesTheCutoffInTheRestaurantsOwnTimezone()
    {
        var restaurant = new Restaurant
        {
            Id = 1, Name = "T", Timezone = "America/New_York", OpenTime = "09:00", CloseTime = "22:00", LastBookingTime = "20:15",
        };
        // 02:00 UTC on the 16th is 21:00 on the 15th in New York, past the 20:15 cutoff.
        var sitting = new DateTime(2026, 1, 16, 2, 0, 0, DateTimeKind.Utc);

        LastBookingHelper.Rejection rejection = LastBookingHelper.RejectionFor(restaurant, sitting);

        Assert.Equal("The last booking for that day is at 20:15. Please choose an earlier time.", rejection.Message);
        Assert.Equal(ErrorCodes.RestaurantPastLastBooking, rejection.Code);
        Assert.Equal("20:15", rejection.Args!["time"]);
    }

    [Fact]
    public void RejectionFor_NamesTheCutoffOfTheServiceTheSittingBelongsTo()
    {
        // Saturday 18:00–02:00 closes its book at 00:30. A Sunday 01:00 sitting is Saturday's
        // tail, so the cutoff it ran past is Saturday's, not Sunday's lunch service's.
        var restaurant = new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC",
            OpenHoursJson = """{"6":{"open":"18:00","close":"02:00","lastBooking":"00:30"},"7":{"open":"11:00","close":"15:00","lastBooking":"13:00"}}""",
        };
        var sunday0100 = new DateTime(2026, 1, 11, 1, 0, 0, DateTimeKind.Utc);

        Assert.Equal("00:30", LastBookingHelper.RejectionFor(restaurant, sunday0100).Args!["time"]);
    }

    [Fact]
    public void RejectionFor_FallsBackToTheSittingsOwnTime_WhenNoCutoffReachesIt()
    {
        var restaurant = new Restaurant { Id = 1, Name = "T", Timezone = "UTC", OpenTime = "09:00", CloseTime = "22:00" };

        Assert.Equal("12:00", LastBookingHelper.RejectionFor(restaurant, new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc)).Args!["time"]);
    }
}
