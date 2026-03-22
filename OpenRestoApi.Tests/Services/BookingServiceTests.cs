using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class BookingServiceTests
{
    // Each test gets a fresh in-memory database with a unique name to avoid
    // cross-test state leakage.
    private static AppDbContext CreateDb(string name)
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    private static BookingService CreateService(
        AppDbContext db,
        IHoldService? holdService = null)
    {
        holdService ??= new Mock<IHoldService>().Object;
        return new BookingService(
            new BookingRepository(db),
            new TableRepository(db),
            new SectionRepository(db),
            new RestaurantRepository(db),
            holdService,
            new BookingMapper());
    }

    private static void Seed(AppDbContext db)
    {
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant" });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();
    }

    // ── CreateBookingAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_ReturnsDto_WithCorrectFields()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_ReturnsDto_WithCorrectFields));
        Seed(db);

        var svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        var result = await svc.CreateBookingAsync(dto);

        Assert.Equal("guest@example.com", result.CustomerEmail);
        Assert.Equal(2, result.Seats);
        Assert.NotEmpty(result.BookingRef!);
    }

    [Fact]
    public async Task CreateBookingAsync_PersistsToDatabase()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_PersistsToDatabase));
        Seed(db);

        var svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        var result = await svc.CreateBookingAsync(dto);

        var inDb = await db.Bookings.FindAsync(result.Id);
        Assert.NotNull(inDb);
        Assert.Equal("guest@example.com", inDb.CustomerEmail);
    }

    [Fact]
    public async Task CreateBookingAsync_GeneratesUniqueBookingRefs()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_GeneratesUniqueBookingRefs));
        Seed(db);
        // Add a second table so we can create two bookings on the same date
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        var svc = CreateService(db);
        var date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc);

        var a = await svc.CreateBookingAsync(new BookingDto
            { RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "a@x.com", Seats = 2, Date = date });
        var b = await svc.CreateBookingAsync(new BookingDto
            { RestaurantId = 1, SectionId = 1, TableId = 2, CustomerEmail = "b@x.com", Seats = 2, Date = date });

        Assert.NotEqual(a.BookingRef, b.BookingRef);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableAlreadyBooked()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_Throws_WhenTableAlreadyBooked));
        Seed(db);

        var svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "first@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        await svc.CreateBookingAsync(dto);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateBookingAsync(dto with { CustomerEmail = "second@example.com" }));

        Assert.Contains("already booked", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableHeldByOther()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_Throws_WhenTableHeldByOther));
        Seed(db);

        var holdMock = new Mock<IHoldService>();
        holdMock
            .Setup(h => h.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>()))
            .Returns(true);

        var svc = CreateService(db, holdMock.Object);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("held by another user", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_ReleasesHold_AfterSuccess()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_ReleasesHold_AfterSuccess));
        Seed(db);

        var holdMock = new Mock<IHoldService>();
        holdMock
            .Setup(h => h.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), "my-hold-id"))
            .Returns(false);

        var svc = CreateService(db, holdMock.Object);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2, HoldId = "my-hold-id",
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        await svc.CreateBookingAsync(dto);

        holdMock.Verify(h => h.ReleaseHold("my-hold-id"), Times.Once);
    }

    [Fact]
    public async Task CreateBookingAsync_StoresSpecialRequests()
    {
        using var db = CreateDb(nameof(CreateBookingAsync_StoresSpecialRequests));
        Seed(db);

        var svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc),
            SpecialRequests = "nut allergy"
        };

        var result = await svc.CreateBookingAsync(dto);

        Assert.Equal("nut allergy", result.SpecialRequests);
    }

    // ── GetBookingByIdAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsDto_WhenFound()
    {
        using var db = CreateDb(nameof(GetBookingByIdAsync_ReturnsDto_WhenFound));
        Seed(db);

        var svc = CreateService(db);
        var created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        var result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result!.Id);
    }

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(GetBookingByIdAsync_ReturnsNull_WhenNotFound));
        Seed(db);

        var result = await CreateService(db).GetBookingByIdAsync(999);

        Assert.Null(result);
    }

    // ── GetBookingByRefAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsDto_WhenFound()
    {
        using var db = CreateDb(nameof(GetBookingByRefAsync_ReturnsDto_WhenFound));
        Seed(db);

        var svc = CreateService(db);
        var created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        var result = await svc.GetBookingByRefAsync(created.BookingRef!);

        Assert.NotNull(result);
        Assert.Equal(created.BookingRef, result!.BookingRef);
    }

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(GetBookingByRefAsync_ReturnsNull_WhenNotFound));
        Seed(db);

        var result = await CreateService(db).GetBookingByRefAsync("no-such-ref");

        Assert.Null(result);
    }

    // ── GetBookingsByRestaurantAsync ──────────────────────────────────────────

    [Fact]
    public async Task GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant()
    {
        using var db = CreateDb(nameof(GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant));
        Seed(db);
        // Second restaurant + table
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Other Place" });
        db.Sections.Add(new Section { Id = 2, Name = "Main", RestaurantId = 2 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 2 });
        db.SaveChanges();

        var svc = CreateService(db);
        var date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc);
        await svc.CreateBookingAsync(new BookingDto
            { RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "a@x.com", Seats = 2, Date = date });
        await svc.CreateBookingAsync(new BookingDto
            { RestaurantId = 2, SectionId = 2, TableId = 2, CustomerEmail = "b@x.com", Seats = 2, Date = date });

        var results = (await svc.GetBookingsByRestaurantAsync(1)).ToList();

        Assert.Single(results);
        Assert.Equal("a@x.com", results[0].CustomerEmail);
    }

    // ── DeleteBookingAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteBookingAsync_RemovesFromDatabase()
    {
        using var db = CreateDb(nameof(DeleteBookingAsync_RemovesFromDatabase));
        Seed(db);

        var svc = CreateService(db);
        var created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        await svc.DeleteBookingAsync(created.Id);

        Assert.Null(await db.Bookings.FindAsync(created.Id));
    }
}
