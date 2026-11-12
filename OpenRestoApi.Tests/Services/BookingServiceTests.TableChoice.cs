using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public partial class BookingServiceTests
{
    // ── Guests choose a section, not a table ────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_RejectsAChosenTable_WhenGuestsMayNotChooseTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAChosenTable_WhenGuestsMayNotChooseTables));
        SeedMultiTableRestaurant(db);
        db.Restaurants.Find(1)!.GuestsChooseTable = false;
        db.SaveChanges();

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "guest@example.com",
            Seats = 2, Date = DateTime.UtcNow.AddDays(3),
        }));

        Assert.Equal(ErrorCodes.BookingTableChoiceDisabled, ex.Code);
        Assert.Empty(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsAChosenGroup_WhenGuestsMayNotChooseTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAChosenGroup_WhenGuestsMayNotChooseTables));
        SeedRestaurantWithGroup(db);
        db.Restaurants.Find(1)!.GuestsChooseTable = false;
        db.SaveChanges();

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, TableGroupId = 1, CustomerEmail = "guest@example.com",
            Seats = 6, Date = DateTime.UtcNow.AddDays(3),
        }));

        Assert.Equal(ErrorCodes.BookingTableChoiceDisabled, ex.Code);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssignsWithinTheSection_WhenGuestsMayNotChooseTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssignsWithinTheSection_WhenGuestsMayNotChooseTables));
        SeedMultiTableRestaurant(db);
        db.Restaurants.Find(1)!.GuestsChooseTable = false;
        db.SaveChanges();

        BookingDto result = await CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 2, CustomerEmail = "guest@example.com",
            Seats = 2, Date = DateTime.UtcNow.AddDays(3),
        });

        Assert.Equal(2, result.SectionId);
        Assert.Equal(4, result.TableId);
    }
}
