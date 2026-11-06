using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The API side of <see cref="DateExceptions"/>: the validated write of a location's date
/// exceptions from an update request, and the list handed back to clients.
/// </summary>
public static class DateExceptionsHelper
{
    /// <summary>The stored exceptions as the API returns them, earliest date first.</summary>
    public static List<DateExceptionDto> ToDtos(Restaurant restaurant)
        => DateExceptions.Parse(restaurant.DateExceptionsJson)
            .Select(e => new DateExceptionDto
            {
                Date = e.Date,
                Type = e.Type,
                Open = e.Kind == DateExceptionType.SpecialHours ? e.Open : null,
                Close = e.Kind == DateExceptionType.SpecialHours ? e.Close : null,
                LastBooking = e.Kind == DateExceptionType.SpecialHours ? e.LastBooking : null,
            })
            .ToList();

    /// <summary>
    /// Validates and stores the whole list: every entry needs a real date and a known type, a
    /// date appears at most once, and a special-hours date needs valid hours with any last
    /// booking time inside them. Dates before today in the restaurant's own clock are dropped,
    /// so the list prunes itself as the admin keeps editing it. An empty list clears the column.
    /// </summary>
    /// <seealso>DateExceptionsHelperTests.Apply_RejectsADuplicateDate</seealso>
    /// <seealso>DateExceptionsHelperTests.Apply_RejectsSpecialHoursWithoutATimes</seealso>
    /// <seealso>DateExceptionsHelperTests.Apply_RejectsALastBookingOutsideTheSpecialHours</seealso>
    /// <seealso>DateExceptionsHelperTests.Apply_KeepsTodayAndDropsYesterday</seealso>
    public static void Apply(Restaurant restaurant, List<DateExceptionDto> exceptions, DateTime nowUtc)
    {
        DateOnly today = DateOnly.FromDateTime(TimeZoneHelper.ConvertUtcToLocal(nowUtc, restaurant.Timezone));
        var byDate = new SortedDictionary<DateOnly, DateException>();

        foreach (DateExceptionDto entry in exceptions)
        {
            DateOnly date = DateExceptions.ParseDate(entry.Date)
                ?? throw new ValidationException("Date exceptions must name a date as yyyy-MM-dd.") { Code = ErrorCodes.RestaurantDateExceptionDateInvalid };

            if (byDate.ContainsKey(date))
            {
                throw new ValidationException($"Date exceptions list {entry.Date} more than once.")
                {
                    Code = ErrorCodes.RestaurantDateExceptionDuplicateDate,
                    Args = new Dictionary<string, object> { ["date"] = entry.Date }
                };
            }

            DateExceptionType type = DateExceptions.ParseType(entry.Type)
                ?? throw new ValidationException("Date exception type must be closed, specialHours or walkInOnly.") { Code = ErrorCodes.RestaurantDateExceptionTypeInvalid };

            if (date < today)
            {
                continue;
            }

            byDate[date] = type == DateExceptionType.SpecialHours
                ? SpecialHours(date, entry)
                : new DateException { Date = DateExceptions.FormatDate(date), Type = DateExceptions.TypeName(type) };
        }

        restaurant.DateExceptionsJson = DateExceptions.Serialize(byDate.Values.ToList());
    }

    private static DateException SpecialHours(DateOnly date, DateExceptionDto entry)
    {
        if (!OpeningHours.TryParseTime(entry.Open, out int openH, out int openM)
            || !OpeningHours.TryParseTime(entry.Close, out int closeH, out int closeM))
        {
            throw new ValidationException($"Special hours on {entry.Date} need an opening and a closing time as HH:mm.")
            {
                Code = ErrorCodes.RestaurantDateExceptionHoursRequired,
                Args = new Dictionary<string, object> { ["date"] = entry.Date }
            };
        }

        string open = OpeningHoursHelper.FormatTime(openH, openM);
        string close = OpeningHoursHelper.FormatTime(closeH, closeM);
        return new DateException
        {
            Date = DateExceptions.FormatDate(date),
            Type = DateExceptions.SpecialHoursType,
            Open = open,
            Close = close,
            LastBooking = OpeningHoursHelper.NormalizeLastBooking(open, close, entry.LastBooking),
        };
    }
}
