using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class AvailabilityServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    private static void SeedRestaurant(AppDbContext db)
    {
        var r = new Restaurant { Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "13:00", Timezone = "UTC" };
        var s = new Section { Id = 1, Name = "Main", RestaurantId = 1 };
        var t1 = new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 };
        var t2 = new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 };
        
        db.Restaurants.Add(r);
        db.Sections.Add(s);
        db.Tables.AddRange(t1, t2);
        db.SaveChanges();
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsAllSlots_WhenNoBookings()
    {
        using var db = CreateDb(nameof(GetAvailabilityAsync_ReturnsAllSlots_WhenNoBookings));
        SeedRestaurant(db);
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        var result = await svc.GetAvailabilityAsync(1, date, 2);

        // 11:00 to 13:00 with 15 min slots = 8 slots
        Assert.Equal(8, result.Slots.Count);
        Assert.All(result.Slots, s => Assert.True(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersOccupiedSlots()
    {
        using var db = CreateDb(nameof(GetAvailabilityAsync_FiltersOccupiedSlots));
        SeedRestaurant(db);
        
        // Book both tables at 12:00
        var date = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = date, BookingRef = "B1" });
        db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, TableId = 2, SectionId = 1, Date = date, BookingRef = "B2" });
        db.SaveChanges();

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var result = await svc.GetAvailabilityAsync(1, date, 2);

        // Slot at 12:00 should be unavailable
        var slot1200 = result.Slots.First(s => s.Time == "12:00");
        Assert.False(slot1200.IsAvailable);

        // Slots at 11:00 should be available (assuming 1 hour duration, 12:00 starts right when 11:00 ends)
        // Wait, 11:00 ends at 12:00. Booking is at 12:00. So 11:00 is fine.
        var slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.True(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ConsidersHolds()
    {
        using var db = CreateDb(nameof(GetAvailabilityAsync_ConsidersHolds));
        SeedRestaurant(db);
        
        var date = new DateTime(2026, 10, 10, 11, 0, 0, DateTimeKind.Utc);
        var holdSvc = new Mock<IHoldService>();
        // Hold both tables at 11:00
        holdSvc.Setup(h => h.IsTableHeld(1, date, null)).Returns(true);
        holdSvc.Setup(h => h.IsTableHeld(2, date, null)).Returns(true);

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var result = await svc.GetAvailabilityAsync(1, date, 2);

        var slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.False(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersByCapacity()
    {
        using var db = CreateDb(nameof(GetAvailabilityAsync_FiltersByCapacity));
        SeedRestaurant(db); // Table 1 (2 seats), Table 2 (4 seats)
        
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        
        // Request 5 seats
        var result = await svc.GetAvailabilityAsync(1, date, 5);
        Assert.All(result.Slots, s => Assert.False(s.IsAvailable));
    }
}
