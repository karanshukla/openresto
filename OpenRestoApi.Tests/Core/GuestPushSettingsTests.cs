using OpenRestoApi.Core.Application.Settings;

namespace OpenRestoApi.Tests.Core;

/// <summary>
/// How <c>GuestPush__ReminderLeadHours</c> becomes the lead list the reminder pass walks: junk
/// and non-positive entries are dropped, duplicates collapse, and the order is longest-first so
/// the schedule reads the way an operator wrote it. A value that yields nothing at all falls back
/// to the shipped default rather than silently disabling reminders.
/// </summary>
public class GuestPushSettingsTests
{
    [Fact]
    public void ReminderLeads_ParsesDistinctPositiveHoursDescending()
    {
        var settings = new GuestPushSettings { ReminderLeadHours = " 2, 24 ,abc, -3, 0, 24, 48,, 2 " };

        Assert.Equal([48, 24, 2], settings.ReminderLeads());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("abc,-1,0")]
    [InlineData(",,,")]
    public void ReminderLeads_FallsBackToTheDefaultWhenNothingParses(string value)
    {
        var settings = new GuestPushSettings { ReminderLeadHours = value };

        Assert.Equal([24, 2], settings.ReminderLeads());
    }

    [Fact]
    public void ReminderLeads_DefaultIsTwentyFourThenTwoHours()
    {
        Assert.Equal([24, 2], new GuestPushSettings().ReminderLeads());
    }
}
