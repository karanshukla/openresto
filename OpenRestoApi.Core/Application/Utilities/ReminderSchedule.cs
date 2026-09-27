namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Which reminder, if any, a subscription is owed right now. Pure so the two rules it encodes
/// are pinned by unit tests rather than by watching a worker tick.
/// </summary>
public static class ReminderSchedule
{
    /// <summary>
    /// The lead time (hours before the sitting) of the reminder due now, or null.
    ///
    /// A reminder is due once its window has opened (<paramref name="nowUtc"/> is within that many
    /// hours of the sitting). Two rules narrow that: a window that had already opened when the guest
    /// opted in is skipped, so booking a table for tomorrow evening does not produce a "24 hours to
    /// go" push seconds after the confirmation; and only a lead shorter than the last one sent
    /// counts, so a device gets each reminder at most once. When several windows are open at once
    /// (the worker was down, or the guest opted in late) the shortest wins and the rest are dropped,
    /// because "your table is in two hours" is the one that is still true.
    /// </summary>
    /// <seealso>ReminderScheduleTests.DueLead_IsNullBeforeTheFirstWindowOpens</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_IsTheLeadWhoseWindowJustOpened</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_SkipsAWindowThatOpenedBeforeTheGuestOptedIn</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_SendsAWindowThatOpenedExactlyAtOptIn</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_NeverRepeatsALeadAlreadySent</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_PicksTheShortestWhenSeveralWindowsAreOpen</seealso>
    /// <seealso>ReminderScheduleTests.DueLead_IsNullOnceTheSittingHasStarted</seealso>
    public static int? DueLead(
        IReadOnlyList<int> leadHours,
        DateTime bookingUtc,
        DateTime subscribedAtUtc,
        int? lastSentLeadHours,
        DateTime nowUtc)
    {
        if (nowUtc >= bookingUtc)
        {
            return null;
        }

        int? due = null;
        foreach (int lead in leadHours)
        {
            DateTime windowOpensAt = bookingUtc.AddHours(-lead);
            bool open = nowUtc >= windowOpensAt;
            bool openedAfterOptIn = subscribedAtUtc <= windowOpensAt;
            bool unsent = lastSentLeadHours is null || lead < lastSentLeadHours.Value;
            if (open && openedAfterOptIn && unsent && (due is null || lead < due.Value))
            {
                due = lead;
            }
        }

        return due;
    }
}
