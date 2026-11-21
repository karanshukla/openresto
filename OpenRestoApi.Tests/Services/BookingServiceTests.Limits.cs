using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public partial class BookingServiceTests
{
    // ── Booking horizon, notice and online party size (#522); date exceptions (#521) ──

    /// <summary>One 4-top, open all day in UTC, with whatever limits the test sets.</summary>
    private static Restaurant SeedLimitedRestaurant(AppDbContext db, Action<Restaurant> configure)
    {
        var restaurant = new Restaurant
        {
            Id = 1, Name = "Limited", OpenTime = "00:00", CloseTime = "00:00", Timezone = "UTC",
        };
        configure(restaurant);
        db.Restaurants.Add(restaurant);
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();
        return restaurant;
    }

    private static BookingDto GuestAt(DateTime date, int seats = 2) => new()
    {
        RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "guest@example.com",
        CustomerName = "Guest", Seats = seats, Date = date,
    };

    private static async Task<ConflictException> AssertRefusedAsync(AppDbContext db, BookingDto dto, string code)
    {
        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService(db).CreateBookingAsync(dto));
        Assert.Equal(code, ex.Code);
        Assert.Empty(db.Bookings);
        return ex;
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsABookingPastTheHorizon()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsABookingPastTheHorizon));
        SeedLimitedRestaurant(db, r => r.MaxBookingDaysAhead = 3);

        ConflictException ex = await AssertRefusedAsync(db, GuestAt(DateTime.UtcNow.Date.AddDays(4).AddHours(12)), ErrorCodes.BookingBeyondHorizon);

        Assert.Equal(3, ex.Args!["days"]);
    }

    [Fact]
    public async Task CreateBookingAsync_AcceptsABookingOnTheLastDayOfTheHorizon()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsABookingOnTheLastDayOfTheHorizon));
        SeedLimitedRestaurant(db, r => r.MaxBookingDaysAhead = 3);

        await CreateService(db).CreateBookingAsync(GuestAt(DateTime.UtcNow.Date.AddDays(3).AddHours(12)));

        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsABookingInsideTheMinimumNotice()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsABookingInsideTheMinimumNotice));
        SeedLimitedRestaurant(db, r => r.MinBookingNoticeMinutes = 120);

        await AssertRefusedAsync(db, GuestAt(DateTime.UtcNow.AddMinutes(30)), ErrorCodes.BookingTooSoon);
    }

    [Fact]
    public async Task CreateBookingAsync_AcceptsABookingPastTheMinimumNotice()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsABookingPastTheMinimumNotice));
        SeedLimitedRestaurant(db, r => r.MinBookingNoticeMinutes = 120);

        await CreateService(db).CreateBookingAsync(GuestAt(DateTime.UtcNow.AddMinutes(180)));

        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsAPartyOverTheOnlineMaximum()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAPartyOverTheOnlineMaximum));
        SeedLimitedRestaurant(db, r => r.MaxOnlinePartySize = 3);

        ConflictException ex = await AssertRefusedAsync(db, GuestAt(DateTime.UtcNow.AddDays(1), seats: 4), ErrorCodes.BookingPartyAboveOnlineMax);

        Assert.Equal(3, ex.Args!["max"]);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsAPartyUnderTheOnlineMinimum()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAPartyUnderTheOnlineMinimum));
        SeedLimitedRestaurant(db, r => r.MinOnlinePartySize = 2);

        await AssertRefusedAsync(db, GuestAt(DateTime.UtcNow.AddDays(1), seats: 1), ErrorCodes.BookingPartyBelowOnlineMin);
    }

    [Fact]
    public async Task CreateBookingAsync_AcceptsAPartyAtTheOnlineMaximum()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsAPartyAtTheOnlineMaximum));
        SeedLimitedRestaurant(db, r => r.MaxOnlinePartySize = 3);

        await CreateService(db).CreateBookingAsync(GuestAt(DateTime.UtcNow.AddDays(1), seats: 3));

        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsABookingOnAWalkInOnlyDate()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsABookingOnAWalkInOnlyDate));
        DateTime sitting = DateTime.UtcNow.Date.AddDays(2).AddHours(12);
        SeedLimitedRestaurant(db, r => r.DateExceptionsJson = $$"""[{"date":"{{sitting:yyyy-MM-dd}}","type":"walkInOnly"}]""");

        await AssertRefusedAsync(db, GuestAt(sitting), ErrorCodes.BookingWalkInOnlyToday);
    }

    [Fact]
    public async Task CreateBookingAsync_AcceptsABookingTheDayAfterAWalkInOnlyDate()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsABookingTheDayAfterAWalkInOnlyDate));
        DateTime walkInDay = DateTime.UtcNow.Date.AddDays(2).AddHours(12);
        SeedLimitedRestaurant(db, r => r.DateExceptionsJson = $$"""[{"date":"{{walkInDay:yyyy-MM-dd}}","type":"walkInOnly"}]""");

        await CreateService(db).CreateBookingAsync(GuestAt(walkInDay.AddDays(1)));

        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsABookingOutsideOpeningHours_WithoutAHold()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsABookingOutsideOpeningHours_WithoutAHold));
        SeedLimitedRestaurant(db, r => { r.OpenTime = "17:00"; r.CloseTime = "22:00"; });

        await AssertRefusedAsync(db, GuestAt(DateTime.UtcNow.Date.AddDays(2).AddHours(22)), ErrorCodes.RestaurantClosedAtTime);
    }

    [Fact]
    public async Task CreateBookingAsync_AcceptsABookingInsideOpeningHours_WithoutAHold()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsABookingInsideOpeningHours_WithoutAHold));
        SeedLimitedRestaurant(db, r => { r.OpenTime = "17:00"; r.CloseTime = "22:00"; });

        await CreateService(db).CreateBookingAsync(GuestAt(DateTime.UtcNow.Date.AddDays(2).AddHours(21)));

        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_ConcurrentRequestsForOneTable_BookItOnce()
    {
        string name = nameof(CreateBookingAsync_ConcurrentRequestsForOneTable_BookItOnce);
        using AppDbContext seed = TestDbFactory.Create(name);
        SeedLimitedRestaurant(seed, _ => { });
        DateTime sitting = DateTime.UtcNow.Date.AddDays(2).AddHours(19);

        // Each request gets its own context, as it would per HTTP request, and the conflict check
        // yields before answering so the two would interleave without the lock.
        async Task<bool> Attempt()
        {
            using AppDbContext db = TestDbFactory.Create(name);
            var real = new BookingRepository(db);
            var slow = new Mock<IBookingRepository>();
            slow.Setup(r => r.IsUnitBookedOnDateAsync(It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<int?>()))
                .Returns(async (int? t, int? g, DateTime d, int m, int? x) =>
                {
                    await Task.Delay(50);
                    return await real.IsUnitBookedOnDateAsync(t, g, d, m, x);
                });
            slow.Setup(r => r.AddAsync(It.IsAny<Booking>())).Returns((Booking b) => real.AddAsync(b));
            var holds = new OpenRestoApi.Infrastructure.Holds.HoldService(new UtcClock());
            var svc = new BookingService(
                slow.Object, new TableRepository(db), new RestaurantRepository(db), holds, new BookingMapper(),
                new TableAutoAssigner(real, holds), new TableGroupRepository(db));
            try
            {
                await svc.CreateBookingAsync(GuestAt(sitting));
                return true;
            }
            catch (ConflictException ex) when (ex.Code == ErrorCodes.BookingTableConflict)
            {
                return false;
            }
        }

        bool[] outcomes = await Task.WhenAll(Attempt(), Attempt());

        Assert.Single(outcomes, booked => booked);
        Assert.Single(seed.Bookings);
    }
}
