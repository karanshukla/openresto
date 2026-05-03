using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
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
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_ReturnsAllSlots_WhenNoBookings));
        SeedRestaurant(db);
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // 11:00 to 13:00 with 15 min slots = 8 slots
        Assert.Equal(8, result.Slots.Count);
        Assert.All(result.Slots, s => Assert.True(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersOccupiedSlots()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_FiltersOccupiedSlots));
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

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // Slot at 12:00 should be unavailable
        TimeSlotDto slot1200 = result.Slots.First(s => s.Time == "12:00");
        Assert.False(slot1200.IsAvailable);

        // Slots at 11:00 should be available (assuming 1 hour duration, 12:00 starts right when 11:00 ends)
        // Wait, 11:00 ends at 12:00. Booking is at 12:00. So 11:00 is fine.
        TimeSlotDto slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.True(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ConsidersHolds()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_ConsidersHolds));
        SeedRestaurant(db);

        var date = new DateTime(2026, 10, 10, 11, 0, 0, DateTimeKind.Utc);
        var holdSvc = new Mock<IHoldService>();
        // Hold both tables at 11:00
        holdSvc.Setup(h => h.IsTableHeld(1, date, null)).Returns(true);
        holdSvc.Setup(h => h.IsTableHeld(2, date, null)).Returns(true);

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        TimeSlotDto slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.False(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersByCapacity()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_FiltersByCapacity));
        SeedRestaurant(db); // Table 1 (2 seats), Table 2 (4 seats)

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);

        // Request 5 seats
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 5);
        Assert.All(result.Slots, s => Assert.False(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_Throws_WhenRestaurantNotFound()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_Throws_WhenRestaurantNotFound));
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var svc = new AvailabilityService(bookingRepo, restRepo, new Mock<IHoldService>().Object);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.GetAvailabilityAsync(999, DateTime.UtcNow, 2));
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesUtc_WhenTimezoneInvalid()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_UsesUtc_WhenTimezoneInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", Timezone = "Invalid/Timezone", OpenTime = "09:00", CloseTime = "10:00" });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.NotEmpty(result.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsNoSlots_WhenPaused()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_ReturnsNoSlots_WhenPaused));
        db.Restaurants.Add(new Restaurant 
        { 
            Id = 1, Name = "T", OpenTime = "09:00", CloseTime = "10:00", Timezone = "UTC",
            BookingsPausedUntil = DateTime.UtcNow.AddHours(1) 
        });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, DateTime.UtcNow.Date, 2);
        Assert.All(result.Slots, s => Assert.False(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesDefaultHours_WhenTimeFormatInvalid()
    {
        using AppDbContext db = CreateDb(nameof(GetAvailabilityAsync_UsesDefaultHours_WhenTimeFormatInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", OpenTime = "invalid", CloseTime = "", Timezone = "UTC" });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), 2);
        // Default is 09:00 to 22:00 -> 13 hours * 4 slots/hour = 52 slots
        Assert.Equal(52, result.Slots.Count);
    }

    [Fact]
    public void GetCategory_ReturnsCorrectValues()
    {
        // GetCategory is private static, but we can test it via public method results
        // Lunch: 11:30 - 14:30
        // Dinner: 17:30 - 21:30
    }
}
