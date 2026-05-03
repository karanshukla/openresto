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
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
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
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_ReturnsDto_WithCorrectFields));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal("guest@example.com", result.CustomerEmail);
        Assert.Equal(2, result.Seats);
        Assert.NotEmpty(result.BookingRef!);
    }

    [Fact]
    public async Task CreateBookingAsync_PersistsToDatabase()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_PersistsToDatabase));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);
        Booking? entity = await db.Bookings.FindAsync(result.Id);
        if (entity != null)
        {
            db.Entry(entity).State = EntityState.Detached;
        }

        Booking? inDb = await db.Bookings.FindAsync(result.Id);
        Assert.NotNull(inDb);
        Assert.Equal("guest@example.com", inDb.CustomerEmail);
    }

    [Fact]
    public async Task CreateBookingAsync_GeneratesUniqueBookingRefs()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_GeneratesUniqueBookingRefs));
        Seed(db);
        // Add a second table so we can create two bookings on the same date
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc);

        BookingDto a = await svc.CreateBookingAsync(new BookingDto
        { RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "a@x.com", Seats = 2, Date = date });
        BookingDto b = await svc.CreateBookingAsync(new BookingDto
        { RestaurantId = 1, SectionId = 1, TableId = 2, CustomerEmail = "b@x.com", Seats = 2, Date = date });

        Assert.NotEqual(a.BookingRef, b.BookingRef);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableAlreadyBooked()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_Throws_WhenTableAlreadyBooked));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "first@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        await svc.CreateBookingAsync(dto);

        var dto2 = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "second@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        InvalidOperationException ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateBookingAsync(dto2));

        Assert.Contains("already booked", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableHeldByOther()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_Throws_WhenTableHeldByOther));
        Seed(db);

        var holdMock = new Mock<IHoldService>();
        holdMock
            .Setup(h => h.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>()))
            .Returns(true);

        BookingService svc = CreateService(db, holdMock.Object);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        InvalidOperationException ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("held by another user", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_ReleasesHold_AfterSuccess()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_ReleasesHold_AfterSuccess));
        Seed(db);

        var holdMock = new Mock<IHoldService>();
        holdMock
            .Setup(h => h.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), "my-hold-id"))
            .Returns(false);

        BookingService svc = CreateService(db, holdMock.Object);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            HoldId = "my-hold-id",
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        await svc.CreateBookingAsync(dto);

        holdMock.Verify(h => h.ReleaseHold("my-hold-id"), Times.Once);
    }

    [Fact]
    public async Task CreateBookingAsync_StoresSpecialRequests()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_StoresSpecialRequests));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc),
            SpecialRequests = "nut allergy"
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal("nut allergy", result.SpecialRequests);
    }

    // ── GetBookingByIdAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(GetBookingByIdAsync_ReturnsDto_WhenFound));
        Seed(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        BookingDto? result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result!.Id);
    }

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(GetBookingByIdAsync_ReturnsNull_WhenNotFound));
        Seed(db);

        BookingDto? result = await CreateService(db).GetBookingByIdAsync(999);

        Assert.Null(result);
    }

    // ── GetBookingByRefAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(GetBookingByRefAsync_ReturnsDto_WhenFound));
        Seed(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        BookingDto? result = await svc.GetBookingByRefAsync(created.BookingRef!);

        Assert.NotNull(result);
        Assert.Equal(created.BookingRef, result!.BookingRef);
    }

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(GetBookingByRefAsync_ReturnsNull_WhenNotFound));
        Seed(db);

        BookingDto? result = await CreateService(db).GetBookingByRefAsync("no-such-ref");

        Assert.Null(result);
    }

    // ── GetBookingsByRestaurantAsync ──────────────────────────────────────────

    [Fact]
    public async Task GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant()
    {
        using AppDbContext db = CreateDb(nameof(GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant));
        Seed(db);
        // Second restaurant + table
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Other Place" });
        db.Sections.Add(new Section { Id = 2, Name = "Main", RestaurantId = 2 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 2 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
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
        using AppDbContext db = CreateDb(nameof(DeleteBookingAsync_RemovesFromDatabase));
        Seed(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        });

        await svc.DeleteBookingAsync(created.Id);

        Assert.Null(await db.Bookings.FindAsync(created.Id));
    }

    // ── Seat Capacity Validation ───────────────────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenSeatsExceedTableCapacity()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_Throws_WhenSeatsExceedTableCapacity));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 5,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        InvalidOperationException ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("only has 4 seats", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Succeeds_WhenSeatsEqualTableCapacity()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_Succeeds_WhenSeatsEqualTableCapacity));
        Seed(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 4,
            Date = new DateTime(2026, 6, 15, 19, 0, 0, DateTimeKind.Utc)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal(4, result.Seats);
        Assert.NotEmpty(result.BookingRef!);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenBookingInPast()
    {
        using AppDbContext db = CreateDb(nameof(CreateBookingAsync_Throws_WhenBookingInPast));
        Seed(db);
        BookingService svc = CreateService(db);
        var dto = new BookingDto { Date = DateTime.UtcNow.AddHours(-1) };
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CreateBookingAsync(dto));
    }

    [Fact]
    public async Task UpdateBookingAsync_SetsDefaultEndTime_WhenMissing()
    {
        using AppDbContext db = CreateDb(nameof(UpdateBookingAsync_SetsDefaultEndTime_WhenMissing));
        Seed(db);
        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddHours(1);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 });
        db.Entry((await db.Bookings.FindAsync(created.Id))!).State = EntityState.Detached;

        var dto = new BookingDto { Id = created.Id, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2, EndTime = null };
        await svc.UpdateBookingAsync(created.Id, dto);
        Booking inDb = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        Assert.Equal(date.AddHours(1), inDb.EndTime);
    }

    [Fact]
    public async Task UpdateBookingAsync_FixesInvalidEndTime()
    {
        using AppDbContext db = CreateDb(nameof(UpdateBookingAsync_FixesInvalidEndTime));
        Seed(db);
        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddHours(1);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 });
        db.Entry((await db.Bookings.FindAsync(created.Id))!).State = EntityState.Detached;

        var dto = new BookingDto { Id = created.Id, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), Seats = 2 };
        await svc.UpdateBookingAsync(created.Id, dto);
        Booking inDb = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        Assert.Equal(date.AddHours(1), inDb.EndTime);
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(CancelBookingAsync_ReturnsFalse_WhenNotFound));
        BookingService svc = CreateService(db);
        Assert.False(await svc.CancelBookingAsync("invalid", "test@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsFalse_WhenEmailMismatch()
    {
        using AppDbContext db = CreateDb(nameof(CancelBookingAsync_ReturnsFalse_WhenEmailMismatch));
        Seed(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "real@test.com", Seats = 2 });
        Assert.False(await svc.CancelBookingAsync(created.BookingRef!, "wrong@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsTrue_WhenAlreadyCancelled()
    {
        using AppDbContext db = CreateDb(nameof(CancelBookingAsync_ReturnsTrue_WhenAlreadyCancelled));
        Seed(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "test@test.com", Seats = 2 });
        await svc.CancelBookingAsync(created.BookingRef!, "test@test.com");
        Assert.True(await svc.CancelBookingAsync(created.BookingRef!, "test@test.com"));
    }
}
