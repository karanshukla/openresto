using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class HoldPolicyServiceTests
{
    private static void SeedRestaurant(AppDbContext db)
    {
        // Uniform 00:00–23:59 UTC so opening-hours never rejects unless overridden.
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC"
        });
        db.SaveChanges();
    }

    private static HoldPolicyService NewService(AppDbContext db)
        => new(new RestaurantRepository(db), new BookingRepository(db));

    [Fact]
    public async Task ValidateAsync_ReturnsNotFound_WhenRestaurantMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsNotFound_WhenRestaurantMissing));
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAsync(999, 1, DateTime.UtcNow.AddDays(1));

        Assert.Equal(HoldPolicyStatus.NotFound, result.Status);
        Assert.Null(result.Restaurant);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_ForPastDate()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_ForPastDate));
        SeedRestaurant(db);
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAsync(1, 1, DateTime.UtcNow.AddDays(-1));

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Equal("Cannot hold a table for a past time.", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_WhenBookingsPaused()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_WhenBookingsPaused));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC",
            BookingsPausedUntil = DateTime.UtcNow.AddDays(7)
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Equal("Bookings are currently paused for this restaurant.", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_WhenLocationIsWalkInOnly()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_WhenLocationIsWalkInOnly));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC",
            WalkInOnly = true
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Contains("walk-ins only", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_WhenDateFallsOnWalkInDay()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_WhenDateFallsOnWalkInDay));
        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        int isoDay = (int)testDate.DayOfWeek == 0 ? 7 : (int)testDate.DayOfWeek;

        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC",
            WalkInDays = isoDay.ToString()
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Contains("walk-ins only on the selected day", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_WhenOutsidePerDayHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_WhenOutsidePerDayHours));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "09:00", CloseTime = "17:00",
            OpenHoursJson = """{"1":{"open":"12:00","close":"14:00"},"2":{"open":"12:00","close":"14:00"},"3":{"open":"12:00","close":"14:00"},"4":{"open":"12:00","close":"14:00"},"5":{"open":"12:00","close":"14:00"},"6":{"open":"12:00","close":"14:00"},"7":{"open":"12:00","close":"14:00"}}"""
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        // 10:00 is inside the uniform 09:00–17:00 but outside the per-day 12:00–14:00
        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Equal("The restaurant is closed at the requested time.", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsEligible_WithinPerDayHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsEligible_WithinPerDayHours));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "09:00", CloseTime = "17:00",
            OpenHoursJson = """{"1":{"open":"12:00","close":"14:00"},"2":{"open":"12:00","close":"14:00"},"3":{"open":"12:00","close":"14:00"},"4":{"open":"12:00","close":"14:00"},"5":{"open":"12:00","close":"14:00"},"6":{"open":"12:00","close":"14:00"},"7":{"open":"12:00","close":"14:00"}}"""
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12).AddMinutes(30);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
        Assert.NotNull(result.Restaurant);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_WhenDayNotInOpenDays()
    {
        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        int isoDay = (int)testDate.DayOfWeek == 0 ? 7 : (int)testDate.DayOfWeek;
        string otherDay = isoDay == 1 ? "2" : "1";

        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_WhenDayNotInOpenDays));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "00:00", CloseTime = "23:59",
            OpenDays = otherDay
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_UsesDefaultHours_WhenStoredTimesAreUnparseable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_UsesDefaultHours_WhenStoredTimesAreUnparseable));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "", CloseTime = ""
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        // Falls back to the default 09:00-22:00 window, so noon is within hours.
        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_HandlesOvernightHours_WhenRequestedTimeIsBeforeMidnightClose()
    {
        // Open 18:00, close 02:00 (after midnight) — 23:00 should be within hours.
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_HandlesOvernightHours_WhenRequestedTimeIsBeforeMidnightClose));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "18:00", CloseTime = "02:00"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(23);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsRejected_OutsideOvernightHoursWindow()
    {
        // Open 18:00, close 02:00 — noon falls outside both segments of the window.
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsRejected_OutsideOvernightHoursWindow));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "18:00", CloseTime = "02:00"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_TreatsEqualOpenAndCloseTimes_AsAlwaysOpen()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_TreatsEqualOpenAndCloseTimes_AsAlwaysOpen));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "00:00", CloseTime = "00:00"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        DateTime testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(3);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_FallsBackToUtc_WhenTimezoneIsInvalid()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_FallsBackToUtc_WhenTimezoneIsInvalid));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "Not/A/Real/Timezone", OpenTime = "00:00", CloseTime = "23:59"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        // Unspecified-kind date forces the timezone-conversion branch.
        var testDate = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(1).AddHours(12), DateTimeKind.Unspecified);
        HoldPolicyResult result = await svc.ValidateAsync(1, 1, testDate);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsBooked_WhenTableHasConfirmedBooking()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_ReturnsBooked_WhenTableHasConfirmedBooking));
        SeedRestaurant(db);
        var date = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = date, BookingRef = "B1"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAsync(1, 1, date);

        Assert.Equal(HoldPolicyStatus.Booked, result.Status);
        Assert.Equal("This table is already booked for that time.", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAsync_PassesRestaurantConfiguredDuration_ToBookingConflictCheck()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAsync_PassesRestaurantConfiguredDuration_ToBookingConflictCheck));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", Timezone = "UTC", OpenTime = "00:00", CloseTime = "23:59",
            DefaultBookingDurationMinutes = 90
        });
        db.SaveChanges();

        var mockBookingRepo = new Mock<IBookingRepository>();
        mockBookingRepo
            .Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(false);
        var svc = new HoldPolicyService(new RestaurantRepository(db), mockBookingRepo.Object);

        var testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        await svc.ValidateAsync(1, 1, testDate);

        mockBookingRepo.Verify(
            b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), 90), Times.Once);
    }

    // ── ValidateAnyTableAsync ────────────────────────────────────────────────
    //
    // Mirrors ValidateAsync's restaurant-level policy gates but skips the per-table booking
    // check (the candidate builder handles that). The tests below confirm the restaurant-level
    // gates still fire and that a confirmed booking does NOT block auto-assign upfront.

    [Fact]
    public async Task ValidateAnyTableAsync_ReturnsNotFound_WhenRestaurantMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAnyTableAsync_ReturnsNotFound_WhenRestaurantMissing));
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAnyTableAsync(999, DateTime.UtcNow.AddDays(1));

        Assert.Equal(HoldPolicyStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task ValidateAnyTableAsync_ReturnsRejected_WhenPastDate()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAnyTableAsync_ReturnsRejected_WhenPastDate));
        SeedRestaurant(db);
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAnyTableAsync(1, DateTime.UtcNow.AddHours(-1));

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Contains("past", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAnyTableAsync_ReturnsRejected_WhenPaused()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAnyTableAsync_ReturnsRejected_WhenPaused));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC",
            BookingsPausedUntil = DateTime.UtcNow.AddDays(1)
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        HoldPolicyResult result = await svc.ValidateAnyTableAsync(1, DateTime.UtcNow.AddDays(2));

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Contains("paused", result.FailureMessage);
    }

    [Fact]
    public async Task ValidateAnyTableAsync_ReturnsEligible_AndSkipsPerTableBookingCheck()
    {
        // Key difference vs ValidateAsync: a confirmed booking on a specific table does NOT
        // block the auto-assign policy gate. The candidate builder will simply exclude that
        // table from the pool; another free table can still win.
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAnyTableAsync_ReturnsEligible_AndSkipsPerTableBookingCheck));
        SeedRestaurant(db);
        var date = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = date, BookingRef = "B1"
        });
        db.SaveChanges();

        // Use a mock booking repo to assert the per-table check is NOT called for auto-assign.
        var mockBookingRepo = new Mock<IBookingRepository>();
        mockBookingRepo
            .Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(true); // would block if called
        var svc = new HoldPolicyService(new RestaurantRepository(db), mockBookingRepo.Object);

        HoldPolicyResult result = await svc.ValidateAnyTableAsync(1, date);

        Assert.Equal(HoldPolicyStatus.Eligible, result.Status);
        Assert.NotNull(result.Restaurant);
        mockBookingRepo.Verify(
            b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAnyTableAsync_ReturnsRejected_WhenClosed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ValidateAnyTableAsync_ReturnsRejected_WhenClosed));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "T", OpenTime = "17:00", CloseTime = "22:00", Timezone = "UTC"
        });
        db.SaveChanges();
        HoldPolicyService svc = NewService(db);

        // 10:00 UTC is before opening — should be rejected.
        var closedTime = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        HoldPolicyResult result = await svc.ValidateAnyTableAsync(1, closedTime);

        Assert.Equal(HoldPolicyStatus.Rejected, result.Status);
        Assert.Contains("closed", result.FailureMessage);
    }
}
