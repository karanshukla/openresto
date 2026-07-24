using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class AdminServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly Mock<IHoldService> _holdServiceMock = new();
    private readonly Mock<IEmailService> _emailServiceMock = new();

    public AdminServiceTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new AppDbContext(opts);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    private AdminService CreateService()
    {
        return new AdminService(
            new BookingRepository(_db),
            new BookingFilterRepository(_db),
            new RestaurantRepository(_db),
            new SectionRepository(_db),
            new TableRepository(_db),
            _holdServiceMock.Object,
            _emailServiceMock.Object);
    }

    private void SeedBase(int restaurantId = 1)
    {
        _db.Restaurants.Add(new Restaurant { Id = restaurantId, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = restaurantId, Name = "Main", RestaurantId = restaurantId });
        _db.Tables.Add(new Table { Id = restaurantId, Name = "T1", Seats = 4, SectionId = restaurantId });
    }

    [Fact]
    public async Task GetOverviewAsync_TotalSeats_HandlesNull()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        // No bookings, totalSeats should be 0
        AdminOverviewDto overview = await svc.GetOverviewAsync();
        Assert.Equal(0, overview.TotalSeats);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyData_HasSevenElements()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(7, overview.OccupancyData.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyData_AllZeroWhenNoBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.All(overview.OccupancyData, v => Assert.Equal(0, v));
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyData_PeakDayIs100Percent()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        // Add 3 bookings today (the peak day) and 1 booking yesterday
        _db.Bookings.Add(new Booking { Id = 10, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "TODAY1" });
        _db.Bookings.Add(new Booking { Id = 11, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(13), BookingRef = "TODAY2" });
        _db.Bookings.Add(new Booking { Id = 12, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(14), BookingRef = "TODAY3" });
        _db.Bookings.Add(new Booking { Id = 13, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddDays(-1).AddHours(12), BookingRef = "YEST" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        // Today (index 6) has 3 bookings — the peak — so it should be 100%
        Assert.Equal(100, overview.OccupancyData[6]);
        // Yesterday (index 5) has 1 booking out of 3 peak → ~33%
        Assert.Equal(33, overview.OccupancyData[5]);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyData_NormalizesRelativeToPeakNotTables()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        // Add extra tables — should NOT affect histogram normalization
        _db.Tables.Add(new Table { Id = 10, Name = "T10", Seats = 4, SectionId = 1 });
        _db.Tables.Add(new Table { Id = 11, Name = "T11", Seats = 4, SectionId = 1 });
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 20, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        // 1 booking today; peak = 1 → today should be 100% regardless of table count
        Assert.Equal(100, overview.OccupancyData[6]);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyData_ExcludesCancelledBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 30, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "ACTIVE", IsCancelled = false });
        _db.Bookings.Add(new Booking { Id = 31, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(13), BookingRef = "CANCELLED", IsCancelled = true });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        // Only 1 non-cancelled booking today; that is the peak → 100%
        Assert.Equal(100, overview.OccupancyData[6]);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyDates_HasSevenElements()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(7, overview.OccupancyDates.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyDates_LastIsToday()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(DateTime.UtcNow.Date.ToString("yyyy-MM-dd"), overview.OccupancyDates[6]);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyDates_AreIsoDateFormat()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.All(overview.OccupancyDates, d => Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", d));
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyDates_AlignedWithOccupancyData()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(overview.OccupancyData.Count, overview.OccupancyDates.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyCounts_HasSevenElements()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(7, overview.OccupancyCounts.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyCounts_AlignedWithOccupancyData()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(overview.OccupancyData.Count, overview.OccupancyCounts.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyCounts_MatchRawBookingsAtPeakDay()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        // 3 bookings today (peak), 1 yesterday
        _db.Bookings.Add(new Booking { Id = 40, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "T1" });
        _db.Bookings.Add(new Booking { Id = 41, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(13), BookingRef = "T2" });
        _db.Bookings.Add(new Booking { Id = 42, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(14), BookingRef = "T3" });
        _db.Bookings.Add(new Booking { Id = 43, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddDays(-1).AddHours(12), BookingRef = "Y1" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        // Today (index 6) is the peak: 3 raw bookings, normalized to 100%.
        Assert.Equal(3, overview.OccupancyCounts[6]);
        Assert.Equal(100, overview.OccupancyData[6]);
        Assert.Equal(1, overview.OccupancyCounts[5]);
    }

    [Fact]
    public async Task GetOverviewAsync_OccupancyCounts_AllZeroWhenNoBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.All(overview.OccupancyCounts, c => Assert.Equal(0, c));
    }

    [Fact]
    public async Task GetOverviewAsync_TodayBookingsList_ContainsTodayBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "TODAY", IsCancelled = false });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.NotNull(overview.TodayBookingsList);
        Assert.Single(overview.TodayBookingsList);
        Assert.Equal("TODAY", overview.TodayBookingsList[0].BookingRef);
    }

    [Fact]
    public async Task GetOverviewAsync_TodayBookingsList_ExcludesCancelledBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "ACTIVE", IsCancelled = false });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(13), BookingRef = "CANCELLED", IsCancelled = true });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Single(overview.TodayBookingsList);
        Assert.Equal("ACTIVE", overview.TodayBookingsList[0].BookingRef);
    }

    [Fact]
    public async Task GetOverviewAsync_TodayBookingsList_ExcludesYesterdayBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddDays(-1), BookingRef = "YESTERDAY" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Empty(overview.TodayBookingsList);
    }

    [Fact]
    public async Task GetOverviewAsync_TodayBookingsList_CountMatchesTodayBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(12), BookingRef = "B1" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(13), BookingRef = "B2" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(overview.TodayBookings, overview.TodayBookingsList.Count);
    }

    [Fact]
    public async Task GetOverviewAsync_TodayBookingsList_OrderedByDate()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(14), BookingRef = "LATE" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.Date.AddHours(10), BookingRef = "EARLY" });
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(2, overview.TodayBookingsList.Count);
        Assert.Equal("EARLY", overview.TodayBookingsList[0].BookingRef);
        Assert.Equal("LATE", overview.TodayBookingsList[1].BookingRef);
    }

    [Fact]
    public async Task GetBookingsAsync_GlobalPastFilter_Works()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        SeedBase(2);
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(-5), BookingRef = "PAST" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 2, SectionId = 2, TableId = 2, Date = nowUtc.AddHours(5), BookingRef = "FUTURE" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> past = await svc.GetBookingsAsync(null, null, "past");
        Assert.Single(past);
        Assert.Equal("PAST", past[0].BookingRef);
    }

    [Fact]
    public async Task GetBookingsAsync_CancelledFilter_Works()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "CANCELLED", IsCancelled = true });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> cancelled = await svc.GetBookingsAsync(1, null, "cancelled");
        Assert.Single(cancelled);
        Assert.Equal("CANCELLED", cancelled[0].BookingRef);

        List<BookingDetailDto> globalCancelled = await svc.GetBookingsAsync(null, null, "cancelled");
        Assert.Single(globalCancelled);
    }

    [Fact]
    public async Task GetBookingsAsync_AllFilter_Works()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(-5), BookingRef = "PAST" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(5), BookingRef = "FUTURE" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> all = await svc.GetBookingsAsync(1, null, "all");
        Assert.Equal(2, all.Count);

        List<BookingDetailDto> globalAll = await svc.GetBookingsAsync(null, null, "all");
        Assert.Equal(2, globalAll.Count);
    }

    [Fact]
    public async Task GetBookingsAsync_WithDateFilter_NoRestaurant_Works()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime today = DateTime.UtcNow.Date;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(12), BookingRef = "TODAY" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> results = await svc.GetBookingsAsync(null, today, "all");
        Assert.Single(results);
    }

    [Fact]
    public async Task GetBookingsAsync_EmailFilter_IsCaseInsensitiveAndPartial()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "A", CustomerEmail = "Alice@Example.com" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B", CustomerEmail = "bob@example.com" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> results = await svc.GetBookingsAsync(1, null, "all", email: "alice");

        Assert.Single(results);
        Assert.Equal("A", results[0].BookingRef);
    }

    [Fact]
    public async Task GetBookingsAsync_BookingRefFilter_IsCaseInsensitiveAndPartial()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "ABC123" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "XYZ789" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> results = await svc.GetBookingsAsync(1, null, "all", bookingRef: "abc");

        Assert.Single(results);
        Assert.Equal("ABC123", results[0].BookingRef);
    }

    [Fact]
    public async Task GetBookingAsync_ReturnsNull_WhenNotFound()
    {
        AdminService svc = CreateService();
        BookingDetailDto? result = await svc.GetBookingAsync(999);
        Assert.Null(result);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableNotFound()
    {
        AdminService svc = CreateService();
        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 999 };
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenRestaurantMismatch()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Restaurants.Add(new Restaurant { Id = 2, Name = "Other" });
        await _db.SaveChangesAsync();
        var req = new AdminCreateBookingRequest { RestaurantId = 2, SectionId = 1, TableId = 1 };
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenConflict()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 };
        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenSeatsExceedCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 1, Seats = 10, Date = DateTime.UtcNow };
        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(req));
    }

    // ── Configurable booking duration (#135) ────────────────────────────────

    [Theory]
    [InlineData(30)]
    [InlineData(90)]
    [InlineData(120)]
    [InlineData(480)]
    public async Task CreateBookingAsync_EndTime_UsesRestaurantConfiguredDuration(int durationMinutes)
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = durationMinutes });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        await _db.SaveChangesAsync();

        DateTime date = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 };

        BookingDetailDto result = await svc.CreateBookingAsync(req);

        Assert.Equal(date.AddMinutes(durationMinutes), result.EndTime);
    }

    [Fact]
    public async Task CreateBookingAsync_ConflictCheck_UsesRestaurantConfiguredDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 120 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime newStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        // Existing (later) booking starts 100 minutes after the new booking's requested start —
        // outside a fixed 60-minute conflict window, but inside the restaurant's configured
        // 120-minute occupancy window for the new booking.
        _db.Bookings.Add(new Booking { RestaurantId = 1, SectionId = 1, TableId = 1, Date = newStart.AddMinutes(100), EndTime = newStart.AddMinutes(100).AddMinutes(120), BookingRef = "LATER1" });
        await _db.SaveChangesAsync();

        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 1, Date = newStart, Seats = 2 };

        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(req));
    }

    // ── Admin past-date creation (#160) ─────────────────────────────────────
    // The admin path intentionally has NO past-date guard (unlike the customer
    // path in BookingService). This test locks that behaviour in so a future
    // change cannot accidentally copy the customer guard into the admin path.
    [Fact]
    public async Task CreateBookingAsync_Succeeds_WithPastDate_AndPersistsAsConfirmed()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 60 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        await _db.SaveChangesAsync();

        // One week in the past — the customer path rejects this, admin must allow it.
        DateTime pastStart = DateTime.UtcNow.AddDays(-7);
        var req = new AdminCreateBookingRequest
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = pastStart,
            Seats = 2,
            CustomerEmail = "admin@example.com",
        };

        BookingDetailDto result = await svc.CreateBookingAsync(req);

        Assert.False(result.IsCancelled);
        Assert.Equal(pastStart, result.Date, TimeSpan.FromSeconds(1));
        Assert.Equal(pastStart.AddMinutes(60), result.EndTime!.Value, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task ExtendBookingAsync_FallsBackToRestaurantConfiguredDuration_WhenEndTimeInvalid()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 90 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime date = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime? newEnd = await svc.ExtendBookingAsync(1, 30);
        Assert.Equal(date.AddMinutes(90).AddMinutes(30), newEnd);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenSeatsExceedCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1", Seats = 2 });
        await _db.SaveChangesAsync();

        var req = new AdminUpdateBookingRequest { Seats = 10 };
        await Assert.ThrowsAsync<BusinessRuleException>(() => svc.AdminUpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenTableNotFound()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new AdminUpdateBookingRequest { TableId = 999 };
        await Assert.ThrowsAsync<ValidationException>(() => svc.AdminUpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenSectionIdChangedWithoutTableId()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Sections.Add(new Section { Id = 2, Name = "Patio", RestaurantId = 1 });
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new AdminUpdateBookingRequest { SectionId = 2 };
        await Assert.ThrowsAsync<ValidationException>(() => svc.AdminUpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_AllowsUnchangedSectionId_WhenOnlyOtherFieldsUpdated()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = DateTime.UtcNow.AddHours(2);
        var req = new AdminUpdateBookingRequest { SectionId = 1, TableId = 1, Date = newDate };
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, req);

        Assert.NotNull(result);
        Assert.Equal(newDate, result!.Date, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_TrimsCustomerName()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new AdminUpdateBookingRequest { CustomerName = "  Jane Doe  " };
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, req);

        Assert.NotNull(result);
        Assert.Equal("Jane Doe", result!.CustomerName);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_ClearsCustomerName_WhenWhitespaceOnly()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1", CustomerName = "Existing Name" });
        await _db.SaveChangesAsync();

        var req = new AdminUpdateBookingRequest { CustomerName = "   " };
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, req);

        Assert.NotNull(result);
        Assert.Null(result!.CustomerName);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_AdjustsEndTime_WhenDateChanges()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = original.AddHours(2), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddDays(1);
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddHours(2), result!.EndTime);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_SetsDefaultEndTime_WhenOriginalEndTimeNull()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = null, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddDays(1);
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddHours(1), result!.EndTime);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_FixesInvalidEndTime()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { CustomerEmail = "new@test.com" });
        Assert.True(result!.EndTime > result.Date);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_SetsDefaultEndTime_UsingRestaurantConfiguredDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 90 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = null, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddDays(1);
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddMinutes(90), result!.EndTime);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_FixesInvalidEndTime_UsingRestaurantConfiguredDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 90 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime date = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { CustomerEmail = "new@test.com" });
        Assert.Equal(date.AddMinutes(90), result!.EndTime);
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_ConflictCheckGuard_IsUnreachable_DueToPreExistingDeadCodeBug()
    {
        // KNOWN PRE-EXISTING BUG — out of scope for #135, not introduced or fixed by it
        // (see .claude/investigations/135-reexamine.md, Gaps #2). AdminUpdateBookingAsync
        // mutates `booking.Date`/`booking.TableId` in place *before* the conflict-check
        // guard compares `req.Date.Value != booking.Date` / `req.TableId.Value !=
        // booking.TableId`. Both comparisons are always false by the time they run
        // (the fields were just set to those exact values), so the conflict-check block
        // is unreachable dead code today.
        //
        // This test PINS that current (buggy-but-harmless-here) behaviour — an update
        // that *should* conflict with an existing booking on the same table currently
        // succeeds instead of throwing — so a future refactor doesn't silently change it
        // unnoticed. It does NOT assert this is correct behaviour; the real fix (compare
        // against the pre-mutation values) is a separate, unrelated follow-up.
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 60 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });

        DateTime original = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        DateTime conflictingSlot = new DateTime(2026, 1, 2, 10, 0, 0, DateTimeKind.Utc);

        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = original.AddMinutes(60), BookingRef = "MOVING" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = conflictingSlot, EndTime = conflictingSlot.AddMinutes(60), BookingRef = "EXISTING" });
        await _db.SaveChangesAsync();

        // Moving booking 1 onto exactly booking 2's slot on the same table would throw if
        // the conflict-check guard above were actually reachable. It isn't, so this
        // currently succeeds — pinning the bug's observable effect, not endorsing it.
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { Date = conflictingSlot });

        Assert.NotNull(result);
        Assert.Equal(conflictingSlot, result!.Date);
    }

    [Fact]
    public async Task GetRestaurantsAsync_ActiveBookingsCount_UsesRestaurantConfiguredDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 120 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime nowUtc = DateTime.UtcNow;
        // Started 90 minutes ago, no EndTime — still active under the restaurant's configured
        // 120-minute duration, but would have already "ended" under the old fixed 60-minute assumption.
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-90), EndTime = null, BookingRef = "ACTIVE1" });
        await _db.SaveChangesAsync();

        List<LookupDto> restaurants = await svc.GetRestaurantsAsync();

        Assert.Equal(1, restaurants.Single(r => r.Id == 1).ActiveBookingsCount);
    }

    [Fact]
    public async Task ExtendAllActiveBookingsAsync_UsesRestaurantConfiguredDuration_ForMissingEndTimeFallback()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", DefaultBookingDurationMinutes = 120 });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime nowUtc = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-90), EndTime = null, BookingRef = "ACTIVE1" });
        await _db.SaveChangesAsync();

        List<BookingDetailDto>? result = await svc.ExtendAllActiveBookingsAsync(1, 15);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(nowUtc.AddMinutes(-90).AddMinutes(120).AddMinutes(15), result[0].EndTime);
    }

    [Fact]
    public async Task ExtendBookingAsync_ReturnsNull_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.Null(await svc.ExtendBookingAsync(999, 30));
    }

    [Fact]
    public async Task ExtendBookingAsync_FallsBackToDate_WhenEndTimeInvalid()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime? newEnd = await svc.ExtendBookingAsync(1, 30);
        Assert.Equal(date.AddHours(1).AddMinutes(30), newEnd);
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsFalse_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.False(await svc.CancelBookingAsync(999));
    }

    [Fact]
    public async Task CancelBookingAsync_Throws_WhenBookingDateIsInThePast()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow.AddHours(-1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(() => svc.CancelBookingAsync(1));

        Booking inDb = await _db.Bookings.FirstAsync(b => b.Id == 1);
        Assert.False(inDb.IsCancelled);
    }

    [Fact]
    public async Task CancelBookingAsync_Succeeds_WithinFiveMinuteGracePeriod()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow.AddMinutes(-4);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        Assert.True(await svc.CancelBookingAsync(1));
    }

    [Fact]
    public async Task CancelBookingAsync_Throws_JustOutsideFiveMinuteGracePeriod()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow.AddMinutes(-6);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(() => svc.CancelBookingAsync(1));
    }

    [Fact]
    public async Task PurgeBookingAsync_ReturnsFalse_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.False(await svc.PurgeBookingAsync(999));
    }

    [Fact]
    public async Task RestoreBookingAsync_ReturnsNull_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.Null(await svc.RestoreBookingAsync(999));
    }

    [Fact]
    public async Task RestoreBookingAsync_Throws_WhenAlreadyActive()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, IsCancelled = false, BookingRef = "B1" });
        await _db.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => svc.RestoreBookingAsync(1));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_ReturnsNull_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.Null(await svc.AdminUpdateBookingAsync(999, new AdminUpdateBookingRequest()));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenInvalidRestaurant()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { RestaurantId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenInvalidTable()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { TableId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenInvalidSection()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { SectionId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenSeatsExceedNewTableCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 2, SectionId = 1 });
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1", Seats = 4 });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<BusinessRuleException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { TableId = 2, Seats = 3 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_HandlesNullEndTime_OnDateChange()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = null, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddHours(5);
        BookingDetailDto? result = await svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddHours(1), result!.EndTime);
    }

    [Fact]
    public async Task GetRestaurantsAsync_ReturnsList()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        List<LookupDto> list = await svc.GetRestaurantsAsync();
        Assert.Single(list);
    }

    // Regression: ActiveBookingsCount was missing b.Date <= nowUtc, causing future
    // bookings to be counted as active and inflating the count shown in the Extend modal.
    [Fact]
    public async Task GetRestaurantsAsync_ActiveBookingsCount_ExcludesFutureBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        // Booking that started 30 min ago and has not ended → ACTIVE
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-30), EndTime = nowUtc.AddMinutes(30), BookingRef = "CURRENT" });
        // Booking starting in 2 hours → NOT active yet
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(2), EndTime = nowUtc.AddHours(3), BookingRef = "FUTURE" });
        await _db.SaveChangesAsync();

        List<LookupDto> list = await svc.GetRestaurantsAsync();

        Assert.Equal(1, list[0].ActiveBookingsCount);
    }

    [Fact]
    public async Task GetRestaurantsAsync_ActiveBookingsCount_ExcludesCancelledBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-30), EndTime = nowUtc.AddMinutes(30), BookingRef = "ACTIVE" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-20), EndTime = nowUtc.AddMinutes(40), BookingRef = "CANCELLED", IsCancelled = true });
        await _db.SaveChangesAsync();

        List<LookupDto> list = await svc.GetRestaurantsAsync();

        Assert.Equal(1, list[0].ActiveBookingsCount);
    }

    [Fact]
    public async Task GetRestaurantsAsync_ActiveBookingsCount_ExcludesPastBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        // Booking that ended 1 hour ago
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(-2), EndTime = nowUtc.AddHours(-1), BookingRef = "PAST" });
        // Current booking
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-15), EndTime = nowUtc.AddMinutes(45), BookingRef = "CURRENT" });
        await _db.SaveChangesAsync();

        List<LookupDto> list = await svc.GetRestaurantsAsync();

        Assert.Equal(1, list[0].ActiveBookingsCount);
    }

    [Fact]
    public async Task GetRestaurantsAsync_ActiveBookingsCount_MatchesExtendAllActiveBookings()
    {
        // The count shown in the UI before extending should equal the number of bookings
        // that ExtendAllActiveBookingsAsync will actually extend.
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-30), EndTime = nowUtc.AddMinutes(30), BookingRef = "CURRENT" });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(2), EndTime = nowUtc.AddHours(3), BookingRef = "FUTURE" });
        _db.Bookings.Add(new Booking { Id = 3, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(-3), EndTime = nowUtc.AddHours(-2), BookingRef = "PAST" });
        await _db.SaveChangesAsync();

        List<LookupDto> restaurantList = await svc.GetRestaurantsAsync();
        List<BookingDetailDto>? extended = await svc.ExtendAllActiveBookingsAsync(1, 30);

        Assert.Equal(restaurantList[0].ActiveBookingsCount, extended!.Count);
    }

    [Fact]
    public async Task GetSectionsAsync_ReturnsList()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        List<LookupDto> list = await svc.GetSectionsAsync(1);
        Assert.Single(list);
    }

    // ── SortOrder / reorderable sections (#178) ──────────────────────────────

    [Fact]
    public async Task GetSectionsAsync_OrdersBySortOrder_NotAlphabetically()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "Zebra", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "Alpha", RestaurantId = 1, SortOrder = 1 });
        await _db.SaveChangesAsync();

        List<LookupDto> list = await svc.GetSectionsAsync(1);

        Assert.Equal(["Zebra", "Alpha"], list.Select(s => s.Name));
    }

    [Fact]
    public async Task GetTablesAsync_OrdersSectionsBySortOrder_NotAlphabetically()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "Zebra", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "Alpha", RestaurantId = 1, SortOrder = 1 });
        await _db.SaveChangesAsync();

        List<SectionDto>? result = await svc.GetTablesAsync(1);

        Assert.NotNull(result);
        Assert.Equal(["Zebra", "Alpha"], result!.Select(s => s.Name));
    }

    [Fact]
    public async Task ReorderSectionsAsync_PersistsNewOrder_AndReadBackIsCorrect()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "Second", RestaurantId = 1, SortOrder = 1 });
        _db.Sections.Add(new Section { Id = 3, Name = "Third", RestaurantId = 1, SortOrder = 2 });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, [3, 1, 2]);

        Assert.True(result);
        List<LookupDto> list = await svc.GetSectionsAsync(1);
        Assert.Equal(["Third", "First", "Second"], list.Select(s => s.Name));
    }

    [Fact]
    public async Task ReorderSectionsAsync_MoveUpSwap_PersistsCorrectly()
    {
        // Simulates the up/down-button UX: moving "Second" up swaps it with "First".
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "Second", RestaurantId = 1, SortOrder = 1 });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, [2, 1]);

        Assert.True(result);
        Assert.Equal(0, (await _db.Sections.FindAsync(2))!.SortOrder);
        Assert.Equal(1, (await _db.Sections.FindAsync(1))!.SortOrder);
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        AdminService svc = CreateService();
        Assert.Null(await svc.ReorderSectionsAsync(999, [1, 2]));
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsFalse_WhenSectionCountMismatch()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        Assert.False(await svc.ReorderSectionsAsync(1, [1, 2]));
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsFalse_WhenSectionIdBelongsToDifferentRestaurant()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1", Timezone = "UTC" });
        _db.Restaurants.Add(new Restaurant { Id = 2, Name = "R2", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "S1", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "S2", RestaurantId = 2, SortOrder = 0 });
        await _db.SaveChangesAsync();

        Assert.False(await svc.ReorderSectionsAsync(1, [2]));
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsFalse_WhenDuplicateIdsProvided()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "Second", RestaurantId = 1, SortOrder = 1 });
        await _db.SaveChangesAsync();

        Assert.False(await svc.ReorderSectionsAsync(1, [1, 1]));
    }

    [Fact]
    public async Task ReorderSectionsAsync_Succeeds_WithSingleSection()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "Only", RestaurantId = 1, SortOrder = 0 });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, [1]);

        Assert.True(result);
        Assert.Equal(0, (await _db.Sections.FindAsync(1))!.SortOrder);
    }

    [Fact]
    public async Task ReorderSectionsAsync_Succeeds_WhenRestaurantHasZeroSections_AndEmptyListProvided()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, []);

        Assert.True(result);
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsFalse_WhenRestaurantHasZeroSections_ButIdsProvided()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        await _db.SaveChangesAsync();

        Assert.False(await svc.ReorderSectionsAsync(1, [1]));
    }

    [Fact]
    public async Task ReorderSectionsAsync_ReturnsFalse_WhenSectionIdsIsNull()
    {
        // Regression guard (#178 review): System.Text.Json overwrites the request DTO's
        // `= new()` field initializer with null when the client sends an explicit
        // `"sectionIds": null`. Without a guard, that null reaches sectionIds.Count /
        // .Distinct() below and throws an unhandled NullReferenceException (500) instead
        // of the clean 400 the rest of the method is designed to return.
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, null!);

        Assert.False(result);
    }

    [Fact]
    public async Task ReorderSectionsAsync_OnlyAffectsTargetRestaurant_WhenReorderingConcurrently()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1", Timezone = "UTC" });
        _db.Restaurants.Add(new Restaurant { Id = 2, Name = "R2", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = 1, Name = "R1-First", RestaurantId = 1, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 2, Name = "R1-Second", RestaurantId = 1, SortOrder = 1 });
        _db.Sections.Add(new Section { Id = 3, Name = "R2-First", RestaurantId = 2, SortOrder = 0 });
        _db.Sections.Add(new Section { Id = 4, Name = "R2-Second", RestaurantId = 2, SortOrder = 1 });
        await _db.SaveChangesAsync();

        bool? result = await svc.ReorderSectionsAsync(1, [2, 1]);

        Assert.True(result);
        Assert.Equal(0, (await _db.Sections.FindAsync(2))!.SortOrder);
        Assert.Equal(1, (await _db.Sections.FindAsync(1))!.SortOrder);
        Assert.Equal(0, (await _db.Sections.FindAsync(3))!.SortOrder);
        Assert.Equal(1, (await _db.Sections.FindAsync(4))!.SortOrder);
    }

    [Fact]
    public async Task CreateRestaurantAsync_Works()
    {
        AdminService svc = CreateService();
        RestaurantDto r = await svc.CreateRestaurantAsync(" New ", " Addr ");
        Assert.Equal("New", r.Name);
        Assert.Equal("Addr", r.Address);
    }

    [Fact]
    public async Task DeleteRestaurantAsync_ReturnsFalse_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.False(await svc.DeleteRestaurantAsync(999));
    }

    [Fact]
    public async Task SetArchivedAsync_ReturnsFalse_WhenNotFound()
    {
        AdminService svc = CreateService();
        Assert.False(await svc.SetArchivedAsync(999, true));
    }

    [Fact]
    public async Task SetArchivedAsync_ArchivesRestaurant_AndReturnsTrue()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC" });
        await _db.SaveChangesAsync();

        bool result = await svc.SetArchivedAsync(1, true);

        Assert.True(result);
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        Assert.True(restaurant.IsArchived);
    }

    [Fact]
    public async Task SetArchivedAsync_UnarchivesRestaurant_WhenArchivedFalse()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "UTC", IsArchived = true });
        await _db.SaveChangesAsync();

        bool result = await svc.SetArchivedAsync(1, false);

        Assert.True(result);
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        Assert.False(restaurant.IsArchived);
    }

    [Fact]
    public async Task GetTablesAsync_ReturnsNull_WhenNoSections()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test" });
        await _db.SaveChangesAsync();
        Assert.Null(await svc.GetTablesAsync(1));
    }

    [Fact]
    public async Task GetOverviewAsync_HandlesInvalidTimezone()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test", Timezone = "Invalid/Zone" });
        await _db.SaveChangesAsync();
        AdminOverviewDto result = await svc.GetOverviewAsync();
        Assert.NotNull(result);
    }

    [Fact]
    public async Task ToDetailDto_HandlesUnspecifiedKind()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime local = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Unspecified);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = local, EndTime = local.AddHours(1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        BookingDetailDto? result = await svc.GetBookingAsync(1);
        Assert.Equal(DateTimeKind.Utc, result!.Date.Kind);
        Assert.Equal(DateTimeKind.Utc, result.EndTime!.Value.Kind);
    }

    [Fact]
    public async Task GetBookingsAsync_ActiveFilter_ExcludesCompletedBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        // 1. Just started (10 mins ago) - should be ACTIVE
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-10), BookingRef = "LIVE" });

        // 2. Started 2 hours ago - should be PAST
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-120), BookingRef = "OLD" });

        // 3. Future - should be ACTIVE
        _db.Bookings.Add(new Booking { Id = 3, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(2), BookingRef = "FUTURE" });

        await _db.SaveChangesAsync();

        List<BookingDetailDto> active = await svc.GetBookingsAsync(1, null, "active");
        List<BookingDetailDto> past = await svc.GetBookingsAsync(1, null, "past");

        Assert.Equal(2, active.Count);
        Assert.Contains(active, b => b.BookingRef == "LIVE");
        Assert.Contains(active, b => b.BookingRef == "FUTURE");

        Assert.Single(past);
        Assert.Equal("OLD", past[0].BookingRef);
    }

    [Fact]
    public async Task GetBookingsAsync_GridMode_ShowsAllBookingsForDay()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime today = DateTime.UtcNow.Date;

        // Morning booking (now past)
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(8), BookingRef = "MORNING" });
        // Evening booking (future)
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(20), BookingRef = "EVENING" });

        await _db.SaveChangesAsync();

        // When requesting a specific date, both should show up regardless of current time
        List<BookingDetailDto> results = await svc.GetBookingsAsync(1, today, "active");

        Assert.Equal(2, results.Count);
    }

    // Regression test: dashboard's "Today's Bookings" was showing cancelled bookings
    // because getAdminDashboardStats called the API with status=all instead of status=active.
    // When status=active + a date are both supplied, the backend enters isGridMode which
    // applies !b.IsCancelled — this test verifies that behaviour.
    [Fact]
    public async Task GetBookingsAsync_ActiveStatusWithDate_ExcludesCancelledBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime today = DateTime.UtcNow.Date;

        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(12), BookingRef = "ACTIVE", IsCancelled = false });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(14), BookingRef = "CANCELLED", IsCancelled = true, CancelledAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> results = await svc.GetBookingsAsync(null, today, "active");

        Assert.Single(results);
        Assert.Equal("ACTIVE", results[0].BookingRef);
    }

    [Fact]
    public async Task GetBookingsAsync_AllStatusWithDate_IncludesCancelledBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime today = DateTime.UtcNow.Date;

        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(12), BookingRef = "ACTIVE", IsCancelled = false });
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = today.AddHours(14), BookingRef = "CANCELLED", IsCancelled = true, CancelledAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> results = await svc.GetBookingsAsync(null, today, "all");

        Assert.Equal(2, results.Count);
    }

    [Fact]
    public async Task ExtendAllActiveBookingsAsync_OnlyExtendsCurrentlyActiveBookings()
    {
        AdminService svc = CreateService();
        SeedBase(1);

        DateTime nowUtc = DateTime.UtcNow;

        // 1. Currently active (started 30 mins ago)
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddMinutes(-30), BookingRef = "ACTIVE" });

        // 2. Future (starting in 1 hour)
        _db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(1), BookingRef = "FUTURE" });

        // 3. Past (ended 1 hour ago)
        _db.Bookings.Add(new Booking { Id = 3, RestaurantId = 1, SectionId = 1, TableId = 1, Date = nowUtc.AddHours(-3), EndTime = nowUtc.AddHours(-1), BookingRef = "PAST" });

        await _db.SaveChangesAsync();

        List<BookingDetailDto>? results = await svc.ExtendAllActiveBookingsAsync(1, 60);

        Assert.NotNull(results);
        Assert.Single(results);
        Assert.Equal("ACTIVE", results[0].BookingRef);

        // Verify the active booking was extended (default 1h -> 2h)
        Booking? activeBooking = await _db.Bookings.FindAsync(1);
        Assert.Equal(nowUtc.AddMinutes(-30).AddMinutes(60).AddMinutes(60), activeBooking!.EndTime);

        // Verify the future booking was NOT extended
        Booking? futureBooking = await _db.Bookings.FindAsync(2);
        Assert.Null(futureBooking!.EndTime);
    }

    [Fact]
    public async Task PauseRestaurantBookingsAsync_ReturnsFalse_WhenRestaurantNotFound()
    {
        AdminService svc = CreateService();
        bool result = await svc.PauseRestaurantBookingsAsync(999, 60);
        Assert.False(result);
    }

    [Fact]
    public async Task PauseRestaurantBookingsAsync_SetsBookingsPausedUntil()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        bool result = await svc.PauseRestaurantBookingsAsync(1, 60);

        Assert.True(result);
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        Assert.NotNull(restaurant.BookingsPausedUntil);
        Assert.True(restaurant.BookingsPausedUntil > DateTime.UtcNow);
    }

    [Fact]
    public async Task UnpauseRestaurantBookingsAsync_ReturnsFalse_WhenRestaurantNotFound()
    {
        AdminService svc = CreateService();
        bool result = await svc.UnpauseRestaurantBookingsAsync(999);
        Assert.False(result);
    }

    [Fact]
    public async Task UnpauseRestaurantBookingsAsync_ClearsBookingsPausedUntil()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        await svc.PauseRestaurantBookingsAsync(1, 60);

        bool result = await svc.UnpauseRestaurantBookingsAsync(1);

        Assert.True(result);
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        Assert.Null(restaurant.BookingsPausedUntil);
    }

    [Fact]
    public async Task ExtendAllActiveBookingsAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        AdminService svc = CreateService();
        List<BookingDetailDto>? result = await svc.ExtendAllActiveBookingsAsync(999, 30);
        Assert.Null(result);
    }

    [Fact]
    public async Task GetOverviewAsync_CountsPausedRestaurants()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        restaurant.BookingsPausedUntil = DateTime.UtcNow.AddHours(1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(1, overview.PausedRestaurantsCount);
    }

    [Fact]
    public async Task GetOverviewAsync_DoesNotCountRestaurants_WithExpiredPause()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        Restaurant restaurant = await _db.Restaurants.SingleAsync(r => r.Id == 1);
        restaurant.BookingsPausedUntil = DateTime.UtcNow.AddHours(-1);
        await _db.SaveChangesAsync();

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.Equal(0, overview.PausedRestaurantsCount);
    }

    [Fact]
    public async Task GetBookingsAsync_UpcomingFilter_BehavesLikeActive()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        List<BookingDetailDto> upcoming = await svc.GetBookingsAsync(1, null, "upcoming");
        List<BookingDetailDto> active = await svc.GetBookingsAsync(1, null, "active");

        Assert.Equal(active.Count, upcoming.Count);
    }

    [Fact]
    public async Task GetBookingsAsync_UnrecognizedStatus_DefaultsToActive()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();

        List<BookingDetailDto> unrecognized = await svc.GetBookingsAsync(1, null, "not-a-real-status");
        List<BookingDetailDto> active = await svc.GetBookingsAsync(1, null, "active");

        Assert.Equal(active.Count, unrecognized.Count);
    }
}
