using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace OpenRestoApi.Core.Domain;

/// <summary>What a date exception does to the weekly schedule on its date.</summary>
public enum DateExceptionType
{
    /// <summary>No service that day: bank holidays, private events.</summary>
    Closed,

    /// <summary>The weekly hours are replaced for that date, with the exception's own last booking time.</summary>
    SpecialHours,

    /// <summary>Open on the weekly hours, but no online bookings: the one-day form of <see cref="Restaurant.WalkInDays"/>.</summary>
    WalkInOnly,
}

/// <summary>
/// One entry of <see cref="Restaurant.DateExceptionsJson"/>: a calendar date and what happens
/// on it instead of the weekly schedule. <see cref="Open"/>, <see cref="Close"/> and
/// <see cref="LastBooking"/> are read for <see cref="DateExceptionType.SpecialHours"/> only.
/// </summary>
public class DateException
{
    /// <summary>The local calendar date, as yyyy-MM-dd.</summary>
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    /// <summary>"closed", "specialHours" or "walkInOnly".</summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("open")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Open { get; set; }

    [JsonPropertyName("close")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Close { get; set; }

    /// <summary>The latest start a booking may have on this date, as HH:mm inside the special hours.</summary>
    [JsonPropertyName("lastBooking")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LastBooking { get; set; }

    [JsonIgnore]
    public DateExceptionType? Kind => DateExceptions.ParseType(Type);

    [JsonIgnore]
    public DateOnly? LocalDate => DateExceptions.ParseDate(Date);
}

/// <summary>
/// Resolves a restaurant's date exceptions, stored as a JSON array in
/// <see cref="Restaurant.DateExceptionsJson"/>, e.g.
/// <c>[{"date":"2026-12-25","type":"closed"},{"date":"2026-12-31","type":"specialHours","open":"18:00","close":"01:00","lastBooking":"23:00"}]</c>.
/// A date carries at most one exception; which schedule it produces is
/// <see cref="ServiceWindowHelper.ScheduleFor"/>'s question. Validating a write is
/// <c>DateExceptionsHelper</c> in Application, which is why the wire names are strings here.
/// </summary>
public static class DateExceptions
{
    public const string ClosedType = "closed";
    public const string SpecialHoursType = "specialHours";
    public const string WalkInOnlyType = "walkInOnly";

    private const string DateFormat = "yyyy-MM-dd";

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static DateExceptionType? ParseType(string? type) => type switch
    {
        ClosedType => DateExceptionType.Closed,
        SpecialHoursType => DateExceptionType.SpecialHours,
        WalkInOnlyType => DateExceptionType.WalkInOnly,
        _ => null,
    };

    public static string TypeName(DateExceptionType type) => type switch
    {
        DateExceptionType.Closed => ClosedType,
        DateExceptionType.SpecialHours => SpecialHoursType,
        _ => WalkInOnlyType,
    };

    public static DateOnly? ParseDate(string? date)
        => DateOnly.TryParseExact(date, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly parsed)
            ? parsed
            : null;

    public static string FormatDate(DateOnly date) => date.ToString(DateFormat, CultureInfo.InvariantCulture);

    /// <summary>
    /// Every entry the column holds that names a real date and a known type, in date order.
    /// Anything else is dropped rather than failing the read, the way
    /// <see cref="OpeningHours.Parse"/> treats a malformed day.
    /// </summary>
    /// <seealso>DateExceptionsTests.Parse_DropsEntriesWithAnUnknownTypeOrDate</seealso>
    public static List<DateException> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            List<DateException>? raw = JsonSerializer.Deserialize<List<DateException>>(json, _jsonOptions);
            return raw?
                .Where(e => e != null && e.Kind.HasValue && e.LocalDate.HasValue)
                .OrderBy(e => e.LocalDate)
                .ToList() ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string? Serialize(IReadOnlyCollection<DateException> exceptions)
        => exceptions.Count == 0
            ? null
            : JsonSerializer.Serialize(exceptions.OrderBy(e => e.LocalDate).ToList());

    /// <summary>The exception that applies on <paramref name="localDate"/>, or null for a weekly-schedule day.</summary>
    /// <seealso>DateExceptionsTests.For_FindsTheEntryOnItsDate</seealso>
    /// <seealso>DateExceptionsTests.For_IsNullOnTheDayAfter</seealso>
    public static DateException? For(Restaurant restaurant, DateTime localDate)
    {
        DateOnly date = DateOnly.FromDateTime(localDate);
        return Parse(restaurant.DateExceptionsJson).FirstOrDefault(e => e.LocalDate == date);
    }
}
