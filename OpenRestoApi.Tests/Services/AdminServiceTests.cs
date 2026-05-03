using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class AdminServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;
    private readonly Mock<IHoldService> _holdServiceMock = new();

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
        return new AdminService(_db, _holdServiceMock.Object);
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
        await Assert.ThrowsAsync<ArgumentException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenRestaurantMismatch()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Restaurants.Add(new Restaurant { Id = 2, Name = "Other" });
        await _db.SaveChangesAsync();
        var req = new AdminCreateBookingRequest { RestaurantId = 2, SectionId = 1, TableId = 1 };
        await Assert.ThrowsAsync<ArgumentException>(() => svc.CreateBookingAsync(req));
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
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenSeatsExceedCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        var req = new AdminCreateBookingRequest { RestaurantId = 1, SectionId = 1, TableId = 1, Seats = 10, Date = DateTime.UtcNow };
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateBookingAsync(req));
    }

    [Fact]
    public async Task UpdateBookingAsync_ReturnsNull_WhenNotFound()
    {
        AdminService svc = CreateService();
        BookingDetailDto? result = await svc.UpdateBookingAsync(999, new UpdateBookingRequest());
        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateBookingAsync_Throws_WhenSeatsExceedCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1", Seats = 2 });
        await _db.SaveChangesAsync();

        var req = new UpdateBookingRequest { Seats = 10 };
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.UpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task UpdateBookingAsync_Throws_WhenTableNotFound()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new UpdateBookingRequest { TableId = 999 };
        await Assert.ThrowsAsync<ArgumentException>(() => svc.UpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task UpdateBookingAsync_Throws_WhenSectionIdProvidedWithoutTableId()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var req = new UpdateBookingRequest { SectionId = 1 };
        await Assert.ThrowsAsync<ArgumentException>(() => svc.UpdateBookingAsync(1, req));
    }

    [Fact]
    public async Task UpdateBookingAsync_AdjustsEndTime_WhenDateChanges()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = original.AddHours(2), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddDays(1);
        BookingDetailDto? result = await svc.UpdateBookingAsync(1, new UpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddHours(2), result!.EndTime);
    }

    [Fact]
    public async Task UpdateBookingAsync_SetsDefaultEndTime_WhenOriginalEndTimeNull()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime original = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = original, EndTime = null, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        DateTime newDate = original.AddDays(1);
        BookingDetailDto? result = await svc.UpdateBookingAsync(1, new UpdateBookingRequest { Date = newDate });
        Assert.Equal(newDate.AddHours(1), result!.EndTime);
    }

    [Fact]
    public async Task UpdateBookingAsync_FixesInvalidEndTime()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        DateTime date = DateTime.UtcNow;
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), BookingRef = "B1" });
        await _db.SaveChangesAsync();

        BookingDetailDto? result = await svc.UpdateBookingAsync(1, new UpdateBookingRequest { CustomerEmail = "new@test.com" });
        Assert.True(result!.EndTime > result.Date);
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
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.RestoreBookingAsync(1));
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

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { RestaurantId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenInvalidTable()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { TableId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenInvalidSection()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { SectionId = 999 }));
    }

    [Fact]
    public async Task AdminUpdateBookingAsync_Throws_WhenSeatsExceedNewTableCapacity()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 2, SectionId = 1 });
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1", Seats = 4 });
        await _db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AdminUpdateBookingAsync(1, new AdminUpdateBookingRequest { TableId = 2, Seats = 3 }));
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

    [Fact]
    public async Task GetSectionsAsync_ReturnsList()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        await _db.SaveChangesAsync();
        List<LookupDto> list = await svc.GetSectionsAsync(1);
        Assert.Single(list);
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
}
