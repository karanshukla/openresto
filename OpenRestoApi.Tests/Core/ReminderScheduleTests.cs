using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Core;

/// <summary>
/// The two rules <see cref="ReminderSchedule.DueLead"/> encodes, each pinned on both sides of
/// its boundary: a window counts only once it has opened and only if it opened at or after the
/// guest opted in, and a device gets each lead at most once, shortest-open-window first.
/// </summary>
public class ReminderScheduleTests
{
    private static readonly int[] Leads = [24, 2];
    private static readonly DateTime Sitting = new(2026, 9, 10, 19, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime OptedInWellBefore = Sitting.AddHours(-48);

    private static DateTime HoursBefore(double hours) => Sitting.AddHours(-hours);

    [Fact]
    public void DueLead_IsNullBeforeTheFirstWindowOpens()
    {
        int? due = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, lastSentLeadHours: null, nowUtc: HoursBefore(24.01));

        Assert.Null(due);
    }

    [Fact]
    public void DueLead_IsTheLeadWhoseWindowJustOpened()
    {
        int? atTwentyFour = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, null, HoursBefore(24));
        int? atTwo = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, lastSentLeadHours: 24, nowUtc: HoursBefore(2));

        Assert.Equal(24, atTwentyFour);
        Assert.Equal(2, atTwo);
    }

    /// <summary>
    /// Booking a table for tomorrow evening must not produce a "24 hours to go" push seconds
    /// after the confirmation: the 24h window had already opened when the guest opted in.
    /// </summary>
    [Fact]
    public void DueLead_SkipsAWindowThatOpenedBeforeTheGuestOptedIn()
    {
        DateTime optedInAfterWindow = HoursBefore(20);

        int? justAfterOptIn = ReminderSchedule.DueLead(Leads, Sitting, optedInAfterWindow, null, HoursBefore(19.9));
        int? whenTheNextWindowOpens = ReminderSchedule.DueLead(Leads, Sitting, optedInAfterWindow, null, HoursBefore(2));

        Assert.Null(justAfterOptIn);
        Assert.Equal(2, whenTheNextWindowOpens);
    }

    [Fact]
    public void DueLead_SendsAWindowThatOpenedExactlyAtOptIn()
    {
        DateTime optedInAsWindowOpened = HoursBefore(24);

        int? due = ReminderSchedule.DueLead(Leads, Sitting, optedInAsWindowOpened, null, HoursBefore(24));

        Assert.Equal(24, due);
    }

    [Fact]
    public void DueLead_NeverRepeatsALeadAlreadySent()
    {
        int? afterTheLong = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, lastSentLeadHours: 24, nowUtc: HoursBefore(23));
        int? afterTheShort = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, lastSentLeadHours: 2, nowUtc: HoursBefore(1));

        Assert.Null(afterTheLong);
        Assert.Null(afterTheShort);
    }

    /// <summary>
    /// A worker that was down through both windows sends "your table is in two hours", not the
    /// stale "24 hours to go"; recording the shorter lead is what then blocks the longer one.
    /// </summary>
    [Fact]
    public void DueLead_PicksTheShortestWhenSeveralWindowsAreOpen()
    {
        int? due = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, null, HoursBefore(1));
        int? afterwards = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, lastSentLeadHours: 2, nowUtc: HoursBefore(0.5));

        Assert.Equal(2, due);
        Assert.Null(afterwards);
    }

    [Fact]
    public void DueLead_IsNullOnceTheSittingHasStarted()
    {
        int? atTheSitting = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, null, Sitting);
        int? afterTheSitting = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, null, Sitting.AddMinutes(1));
        int? justBefore = ReminderSchedule.DueLead(Leads, Sitting, OptedInWellBefore, null, Sitting.AddMinutes(-1));

        Assert.Null(atTheSitting);
        Assert.Null(afterTheSitting);
        Assert.Equal(2, justBefore);
    }
}
