namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Centralises restaurant-timezone conversions. All <see cref="DateTime"/> values are stored
/// and exchanged as UTC; conversion to/from a restaurant's IANA timezone happens only at the
/// edges (availability calc, opening-hours checks, email rendering). Invalid timezone ids fall
/// back to UTC, matching the behaviour previously inlined in every caller.
/// </summary>
public static class TimeZoneHelper
{
    /// <summary>
    /// Resolves an IANA timezone id into a <see cref="TimeZoneInfo"/>, falling back to UTC for
    /// unknown ids. Replaces the <c>try FindSystemTimeZoneById catch UTC</c> boilerplate that
    /// was duplicated across controllers and services.
    /// </summary>
    public static TimeZoneInfo Resolve(string? timezoneId)
    {
        if (string.IsNullOrWhiteSpace(timezoneId))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        }
        // InvalidTimeZoneException is only thrown when the host's tzdata for an id
        // FindSystemTimeZoneById already recognized is itself corrupt — not reproducible by
        // crafting an id string, so it shares TimeZoneNotFoundException's fallback rather
        // than carrying its own untestable branch.
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>
    /// Converts a restaurant-local <see cref="DateTime"/> to UTC. Treats <see cref="DateTimeKind.Unspecified"/>
    /// as restaurant-local (the canonical case — client sends a date-only or naive-timestamp param),
    /// and <see cref="DateTimeKind.Local"/>/<see cref="DateTimeKind.Utc"/> inputs via the standard
    /// <see cref="DateTime.ToUniversalTime"/> path.
    /// </summary>
    public static DateTime ConvertLocalToUtc(DateTime local, string timezoneId)
    {
        if (local.Kind != DateTimeKind.Unspecified)
        {
            return local.ToUniversalTime();
        }

        return TimeZoneInfo.ConvertTimeToUtc(local, Resolve(timezoneId));
    }

    /// <summary>
    /// Converts a UTC instant to a restaurant-local <see cref="DateTime"/> (Unspecified kind —
    /// callers treat the result as a wall-clock value, not a UTC value).
    /// </summary>
    public static DateTime ConvertUtcToLocal(DateTime utc, string timezoneId)
    {
        DateTime source = utc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utc, DateTimeKind.Utc)
            : utc;

        return TimeZoneInfo.ConvertTimeFromUtc(source, Resolve(timezoneId));
    }

    /// <summary>
    /// Returns the [start, end) UTC window covering one local calendar day in the given timezone.
    ///
    /// When <paramref name="referenceDate"/> is UTC, it is first shifted into the restaurant's
    /// local calendar so the window reflects "today" from the restaurant's perspective — a UTC+
    /// restaurant may already be on the next calendar day while UTC is still "yesterday". When
    /// <paramref name="referenceDate"/> is Unspecified (a client date-only param like "2026-05-26"),
    /// it is treated directly as the restaurant's local date without conversion.
    ///
    /// Matches the behaviour of the previous <c>AdminService.GetUtcRangeForLocalDay</c> private
    /// helper, which <c>TimezoneLogicTests</c> asserted against (Toronto/Sydney/Tokyo/invalid-tz).
    /// </summary>
    public static (DateTime Start, DateTime End) GetUtcRangeForLocalDay(DateTime referenceDate, string timezoneId)
    {
        TimeZoneInfo tz = Resolve(timezoneId);

        DateTime localDay = referenceDate.Kind == DateTimeKind.Utc
            ? TimeZoneInfo.ConvertTimeFromUtc(referenceDate, tz).Date
            : referenceDate.Date;

        DateTime localStart = DateTime.SpecifyKind(localDay, DateTimeKind.Unspecified);
        DateTime localEnd = DateTime.SpecifyKind(localDay.AddDays(1), DateTimeKind.Unspecified);

        DateTime utcStart = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        DateTime utcEnd = TimeZoneInfo.ConvertTimeToUtc(localEnd, tz);

        return (utcStart, utcEnd);
    }
}
