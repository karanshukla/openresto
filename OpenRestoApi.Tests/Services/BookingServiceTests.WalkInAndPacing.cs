using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public partial class BookingServiceTests
{
    // ── Walk-in-only tables (#454) ──────────────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_RejectsAWalkInOnlyTable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAWalkInOnlyTable));
        SeedRestaurantWithGroup(db);
        db.Tables.Find(1)!.WalkInOnly = true;
        db.SaveChanges();

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "guest@example.com",
            Seats = 2, Date = DateTime.UtcNow.AddDays(3),
        }));

        Assert.Equal(ErrorCodes.TableWalkInOnly, ex.Code);
        Assert.Empty(db.Bookings);
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsAGroupHoldingAWalkInOnlyTable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAGroupHoldingAWalkInOnlyTable));
        SeedRestaurantWithGroup(db);
        db.Tables.Find(3)!.WalkInOnly = true;
        db.SaveChanges();

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, TableGroupId = 1, CustomerEmail = "guest@example.com",
            Seats = 6, Date = DateTime.UtcNow.AddDays(3),
        }));

        Assert.Equal(ErrorCodes.TableWalkInOnly, ex.Code);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssignsAroundAWalkInOnlyTable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssignsAroundAWalkInOnlyTable));
        SeedRestaurantWithGroup(db);
        db.Tables.Find(1)!.WalkInOnly = true;
        db.SaveChanges();

        // T1 is the only 2-top, so a party of 2 would land there. Held back, it gets a 4-top.
        BookingDto result = await CreateService(db).CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, CustomerEmail = "guest@example.com", Seats = 2, Date = DateTime.UtcNow.AddDays(3),
        });

        Assert.NotEqual(1, result.TableId);
    }

    // ── Cover pacing (#455) ─────────────────────────────────────────────────

    /// <summary>
    /// Four 4-tops open all day on 30-minute slots, capped at six covers per slot, with a party of
    /// four already starting at 19:15 in the 19:00 slot. Returns 19:00 two days out.
    /// </summary>
    private static DateTime SeedPacedRestaurant(AppDbContext db)
    {
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Paced", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC",
            BookingSlotIntervalMinutes = 30, MaxCoversPerSlot = 6,
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        for (int id = 1; id <= 4; id++)
        {
            db.Tables.Add(new Table { Id = id, Name = $"T{id}", Seats = 4, SectionId = 1 });
        }

        DateTime slot = DateTime.UtcNow.Date.AddDays(2).AddHours(19);
        db.Bookings.Add(new Booking
        {
            RestaurantId = 1, SectionId = 1, TableId = 1, Seats = 4, BookingRef = "PACE1",
            Date = slot.AddMinutes(15), EndTime = slot.AddMinutes(75),
        });
        db.SaveChanges();
        return slot;
    }

    private static BookingDto PartyAt(DateTime date, int seats, int tableId) => new()
    {
        RestaurantId = 1, SectionId = 1, TableId = tableId, CustomerEmail = "guest@example.com",
        Seats = seats, Date = date,
    };

    [Fact]
    public async Task CreateBookingAsync_AcceptsAPartyThatExactlyFillsTheCoverCap()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AcceptsAPartyThatExactlyFillsTheCoverCap));
        DateTime slot = SeedPacedRestaurant(db);

        await CreateService(db).CreateBookingAsync(PartyAt(slot, seats: 2, tableId: 2));

        Assert.Equal(6, db.Bookings.Sum(b => b.Seats));
    }

    [Fact]
    public async Task CreateBookingAsync_RejectsAPartyOneGuestOverTheCoverCap()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_RejectsAPartyOneGuestOverTheCoverCap));
        DateTime slot = SeedPacedRestaurant(db);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => CreateService(db).CreateBookingAsync(PartyAt(slot, seats: 3, tableId: 2)));

        Assert.Equal(ErrorCodes.BookingPacingFull, ex.Code);
        Assert.Equal(6, ex.Args!["cap"]);
        Assert.Equal(2, ex.Args["remaining"]);
        Assert.Equal("19:00", ex.Args["time"]);
    }

    [Fact]
    public async Task CreateBookingAsync_CountsAnOffGridTimeAgainstItsSlot()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_CountsAnOffGridTimeAgainstItsSlot));
        DateTime slot = SeedPacedRestaurant(db);

        // 19:10 is not a slot the page offers, but it is still inside the 19:00 slot.
        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => CreateService(db).CreateBookingAsync(PartyAt(slot.AddMinutes(10), seats: 3, tableId: 2)));

        Assert.Equal(ErrorCodes.BookingPacingFull, ex.Code);
    }

    [Fact]
    public async Task CreateBookingAsync_IgnoresCoversStartingInThePreviousSlot()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_IgnoresCoversStartingInThePreviousSlot));
        DateTime slot = SeedPacedRestaurant(db);

        // The 19:15 party is already seated by 19:30, so the whole cap is free again.
        await CreateService(db).CreateBookingAsync(PartyAt(slot.AddMinutes(30), seats: 4, tableId: 2));
        await CreateService(db).CreateBookingAsync(PartyAt(slot.AddMinutes(45), seats: 2, tableId: 3));

        Assert.Equal(3, db.Bookings.Count());
    }

    [Fact]
    public async Task CreateBookingAsync_IgnoresCancelledCovers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_IgnoresCancelledCovers));
        DateTime slot = SeedPacedRestaurant(db);
        db.Bookings.Single().IsCancelled = true;
        db.SaveChanges();

        await CreateService(db).CreateBookingAsync(PartyAt(slot, seats: 4, tableId: 2));

        Assert.Equal(2, db.Bookings.Count());
    }
}
