using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class DateExceptionsHelperTests
{
    private static readonly DateTime Now = new(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);

    private static Restaurant NewRestaurant(string timezone = "UTC") => new()
    {
        Id = 1,
        Name = "T",
        OpenTime = "09:00",
        CloseTime = "22:00",
        Timezone = timezone,
    };

    private static DateExceptionDto Closed(string date) => new() { Date = date, Type = "closed" };

    private static DateExceptionDto Special(string date, string open, string close, string? lastBooking = null)
        => new() { Date = date, Type = "specialHours", Open = open, Close = close, LastBooking = lastBooking };

    [Fact]
    public void Apply_StoresTheListInDateOrder_AndReadsItBack()
    {
        Restaurant r = NewRestaurant();

        DateExceptionsHelper.Apply(r, [Special("2026-12-31", "18:00", "1:00", "23:00"), Closed("2026-12-25"),
            new DateExceptionDto { Date = "2026-12-24", Type = "walkInOnly", Open = "ignored" }], Now);
        List<DateExceptionDto> dtos = DateExceptionsHelper.ToDtos(r);

        Assert.Equal(["2026-12-24", "2026-12-25", "2026-12-31"], dtos.Select(d => d.Date));
        Assert.Equal(["walkInOnly", "closed", "specialHours"], dtos.Select(d => d.Type));
        Assert.Null(dtos[0].Open);
        Assert.Equal("18:00", dtos[2].Open);
        Assert.Equal("01:00", dtos[2].Close);
        Assert.Equal("23:00", dtos[2].LastBooking);
    }

    [Fact]
    public void Apply_ClearsTheColumnForAnEmptyList()
    {
        Restaurant r = NewRestaurant();
        r.DateExceptionsJson = """[{"date":"2026-12-25","type":"closed"}]""";

        DateExceptionsHelper.Apply(r, [], Now);

        Assert.Null(r.DateExceptionsJson);
    }

    [Fact]
    public void Apply_KeepsTodayAndDropsYesterday()
    {
        Restaurant r = NewRestaurant();

        DateExceptionsHelper.Apply(r, [Closed("2026-06-14"), Closed("2026-06-15")], Now);

        Assert.Equal(["2026-06-15"], DateExceptionsHelper.ToDtos(r).Select(d => d.Date));
    }

    [Fact]
    public void Apply_JudgesTodayInTheRestaurantsOwnClock()
    {
        // 23:30 UTC on the 14th is already the 15th in Tokyo, so the 14th is gone there.
        Restaurant r = NewRestaurant(timezone: "Asia/Tokyo");

        DateExceptionsHelper.Apply(r, [Closed("2026-06-14")], new DateTime(2026, 6, 14, 23, 30, 0, DateTimeKind.Utc));

        Assert.Null(r.DateExceptionsJson);
    }

    [Fact]
    public void Apply_RejectsADuplicateDate()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => DateExceptionsHelper.Apply(NewRestaurant(), [Closed("2026-12-25"), Special("2026-12-25", "12:00", "16:00")], Now));

        Assert.Equal(ErrorCodes.RestaurantDateExceptionDuplicateDate, ex.Code);
    }

    [Fact]
    public void Apply_RejectsAnUnparseableDate()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => DateExceptionsHelper.Apply(NewRestaurant(), [Closed("25/12/2026")], Now));

        Assert.Equal(ErrorCodes.RestaurantDateExceptionDateInvalid, ex.Code);
    }

    [Fact]
    public void Apply_RejectsAnUnknownType()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => DateExceptionsHelper.Apply(NewRestaurant(), [new DateExceptionDto { Date = "2026-12-25", Type = "holiday" }], Now));

        Assert.Equal(ErrorCodes.RestaurantDateExceptionTypeInvalid, ex.Code);
    }

    [Fact]
    public void Apply_RejectsSpecialHoursWithoutATimes()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => DateExceptionsHelper.Apply(NewRestaurant(), [Special("2026-12-31", "18:00", "")], Now));

        Assert.Equal(ErrorCodes.RestaurantDateExceptionHoursRequired, ex.Code);
    }

    [Fact]
    public void Apply_RejectsALastBookingOutsideTheSpecialHours()
    {
        ValidationException ex = Assert.Throws<ValidationException>(
            () => DateExceptionsHelper.Apply(NewRestaurant(), [Special("2026-12-31", "12:00", "16:00", "17:00")], Now));

        Assert.Equal(ErrorCodes.RestaurantLastBookingOutsideHours, ex.Code);
    }

    [Fact]
    public void Apply_AcceptsALastBookingInsideAnOvernightSpecialWindow()
    {
        Restaurant r = NewRestaurant();

        DateExceptionsHelper.Apply(r, [Special("2026-12-31", "18:00", "02:00", "00:30")], Now);

        Assert.Equal("00:30", DateExceptionsHelper.ToDtos(r).Single().LastBooking);
    }
}
