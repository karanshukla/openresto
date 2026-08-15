using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class PauseHelperTests
{
    [Fact]
    public void RejectionMessage_NamesTheEndOfTheWindow_InTheRestaurantsOwnTimezone()
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Name = "T",
            Timezone = "America/New_York",
            // 20:30 UTC is 15:30 in New York (EST) — the diner is told the local time.
            BookingsPausedUntil = new DateTime(2026, 1, 15, 20, 30, 0, DateTimeKind.Utc)
        };

        Assert.Equal("Bookings are paused until 15:30. Please choose a later time.",
            PauseHelper.RejectionMessage(restaurant));
    }

    [Fact]
    public void RejectionMessage_FallsBackToAGenericLine_WhenNoWindowIsSet()
    {
        var restaurant = new Restaurant { Id = 1, Name = "T", Timezone = "UTC" };

        Assert.Equal("Bookings for this restaurant are currently paused. Please try again later.",
            PauseHelper.RejectionMessage(restaurant));
    }
}
