using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class AdminServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public AdminServiceTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new AppDbContext(opts);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private AdminService CreateService()
    {
        return new AdminService(_db);
    }

    private void SeedBase(int restaurantId = 1)
    {
        _db.Restaurants.Add(new Restaurant { Id = restaurantId, Name = "Test", Timezone = "UTC" });
        _db.Sections.Add(new Section { Id = restaurantId, Name = "Main", RestaurantId = restaurantId });
        _db.Tables.Add(new Table { Id = restaurantId, Name = "T1", Seats = 4, SectionId = restaurantId });
    }

    [Fact]
    public async Task GetOverviewAsync_ReturnsValidStats()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow, BookingRef = "B1" });
        await _db.SaveChangesAsync();

        var overview = await svc.GetOverviewAsync();
        
        Assert.NotNull(overview);
        Assert.Equal(1, overview.TotalRestaurants);
        Assert.Equal(1, overview.TotalBookings);
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

        var active = await svc.GetBookingsAsync(1, null, "active");
        var past = await svc.GetBookingsAsync(1, null, "past");

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
        var results = await svc.GetBookingsAsync(1, today, "active");

        Assert.Equal(2, results.Count);
    }
}
