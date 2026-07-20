using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class BookingServiceTests
{
    private static BookingService CreateService(
        AppDbContext db,
        IHoldService? holdService = null,
        IBookingConfirmationService? confirmationService = null)
    {
        // Auto-assign tests need a real in-memory HoldService so PlaceAutoHold actually places
        // holds (a loose Mock<IHoldService> returns null from PlaceAutoHold, which the service
        // interprets as "all candidates held"). Tests that don't exercise auto-assign can pass
        // their own mock.
        holdService ??= new OpenRestoApi.Infrastructure.Holds.HoldService(new UtcClock());
        return new BookingService(
            new BookingRepository(db),
            new TableRepository(db),
            new SectionRepository(db),
            new RestaurantRepository(db),
            holdService,
            new BookingMapper(),
            new TableAutoAssigner(new BookingRepository(db)),
            confirmationService);
    }

    private sealed class UtcClock : ISystemClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    /// <summary>
    /// Seeds a restaurant with two sections and a spread of table sizes, for auto-assign
    /// tests that need to assert "smallest fitting free table across sections".
    ///
    /// Section 1 "Main":  T1 (2 seats), T2 (4 seats), T3 (6 seats)
    /// Section 2 "Patio": P1 (2 seats), P2 (4 seats)
    /// </summary>
    private static void SeedMultiTableRestaurant(AppDbContext db)
    {
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "Auto-Assign Bistro",
            OpenTime = "00:00",
            CloseTime = "23:59",
            Timezone = "UTC"
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Sections.Add(new Section { Id = 2, Name = "Patio", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 3, Name = "T3", Seats = 6, SectionId = 1 });
        db.Tables.Add(new Table { Id = 4, Name = "P1", Seats = 2, SectionId = 2 });
        db.Tables.Add(new Table { Id = 5, Name = "P2", Seats = 4, SectionId = 2 });
        db.SaveChanges();
    }

    // ── CreateBookingAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_ReturnsDto_WithCorrectFields()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_ReturnsDto_WithCorrectFields));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal("guest@example.com", result.CustomerEmail);
        Assert.Equal(2, result.Seats);
        Assert.NotEmpty(result.BookingRef!);
    }

    [Fact]
    public async Task CreateBookingAsync_PersistsToDatabase()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_PersistsToDatabase));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
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
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GeneratesUniqueBookingRefs));
        TestSeed.BasicRestaurant(db);
        // Add a second table so we can create two bookings on the same date
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var date = DateTime.UtcNow.AddDays(7);

        BookingDto a = await svc.CreateBookingAsync(new BookingDto
        { RestaurantId = 1, SectionId = 1, TableId = 1, CustomerEmail = "a@x.com", Seats = 2, Date = date });
        BookingDto b = await svc.CreateBookingAsync(new BookingDto
        { RestaurantId = 1, SectionId = 1, TableId = 2, CustomerEmail = "b@x.com", Seats = 2, Date = date });

        Assert.NotEqual(a.BookingRef, b.BookingRef);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableAlreadyBooked()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenTableAlreadyBooked));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "first@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        };

        await svc.CreateBookingAsync(dto);

        var dto2 = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "second@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto2));

        Assert.Contains("already booked", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableHeldByOther()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenTableHeldByOther));
        TestSeed.BasicRestaurant(db);

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
            Date = DateTime.UtcNow.AddDays(7)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("held by another user", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_ReleasesHold_AfterSuccess()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_ReleasesHold_AfterSuccess));
        TestSeed.BasicRestaurant(db);

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
            Date = DateTime.UtcNow.AddDays(7)
        };

        await svc.CreateBookingAsync(dto);

        holdMock.Verify(h => h.ReleaseHold("my-hold-id"), Times.Once);
    }

    // ── Configurable booking duration (#135) ────────────────────────────────

    [Theory]
    [InlineData(30)]
    [InlineData(90)]
    [InlineData(120)]
    [InlineData(480)]
    public async Task CreateBookingAsync_EndTime_UsesRestaurantConfiguredDuration(int durationMinutes)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateBookingAsync_EndTime_UsesRestaurantConfiguredDuration)}_{durationMinutes}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", DefaultBookingDurationMinutes = durationMinutes });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddDays(7);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = date
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal(result.Date.AddMinutes(durationMinutes), result.EndTime);
    }

    [Fact]
    public async Task CreateBookingAsync_EndTime_DefaultsToOneHour_WhenRestaurantDurationNotSet()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_EndTime_DefaultsToOneHour_WhenRestaurantDurationNotSet));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddDays(7);
        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = date
        });

        Assert.Equal(result.Date.AddHours(1), result.EndTime);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenNewBookingDurationOverlapsLaterBooking()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenNewBookingDurationOverlapsLaterBooking));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", DefaultBookingDurationMinutes = 120 });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime firstStart = DateTime.UtcNow.AddDays(7);
        // Existing booking starts 100 minutes after the new one — outside a fixed 60-minute
        // window, but inside the restaurant's configured 120-minute occupancy window.
        db.Bookings.Add(new Booking
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = firstStart.AddMinutes(100),
            EndTime = firstStart.AddMinutes(100).AddMinutes(120),
            CustomerEmail = "later@x.com",
            Seats = 2,
            BookingRef = "LATER1"
        });
        await db.SaveChangesAsync();

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = firstStart
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto));
        Assert.Contains("already booked", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenOverlapsLegacyBookingWithoutEndTime_UsingConfiguredDuration()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenOverlapsLegacyBookingWithoutEndTime_UsingConfiguredDuration));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", DefaultBookingDurationMinutes = 90 });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime legacyStart = DateTime.UtcNow.AddDays(7);
        // Legacy booking with no EndTime at all (pre-migration data)
        db.Bookings.Add(new Booking
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = legacyStart,
            EndTime = null,
            CustomerEmail = "legacy@x.com",
            Seats = 2,
            BookingRef = "LEGACY1"
        });
        await db.SaveChangesAsync();

        BookingService svc = CreateService(db);
        // 70 minutes after the legacy booking — outside the old fixed 60-minute fallback,
        // but inside the restaurant's configured 90-minute window.
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = legacyStart.AddMinutes(70)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto));
        Assert.Contains("already booked", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_StoresSpecialRequests()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_StoresSpecialRequests));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
            SpecialRequests = "nut allergy"
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal("nut allergy", result.SpecialRequests);
    }

    // ── GetBookingByIdAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByIdAsync_ReturnsDto_WhenFound));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        });

        BookingDto? result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal(created.Id, result!.Id);
    }

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByIdAsync_ReturnsNull_WhenNotFound));
        TestSeed.BasicRestaurant(db);

        BookingDto? result = await CreateService(db).GetBookingByIdAsync(999);

        Assert.Null(result);
    }

    // ── GetBookingByRefAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByRefAsync_ReturnsDto_WhenFound));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        });

        BookingDto? result = await svc.GetBookingByRefAsync(created.BookingRef!);

        Assert.NotNull(result);
        Assert.Equal(created.BookingRef, result!.BookingRef);
    }

    [Fact]
    public async Task GetBookingByRefAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByRefAsync_ReturnsNull_WhenNotFound));
        TestSeed.BasicRestaurant(db);

        BookingDto? result = await CreateService(db).GetBookingByRefAsync("no-such-ref");

        Assert.Null(result);
    }

    // ── GetBookingsByRestaurantAsync ──────────────────────────────────────────

    [Fact]
    public async Task GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingsByRestaurantAsync_ReturnsOnlyMatchingRestaurant));
        TestSeed.BasicRestaurant(db);
        // Second restaurant + table
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Other Place" });
        db.Sections.Add(new Section { Id = 2, Name = "Main", RestaurantId = 2 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 2 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var date = DateTime.UtcNow.AddDays(7);
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
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteBookingAsync_RemovesFromDatabase));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        });

        await svc.DeleteBookingAsync(created.Id);

        Assert.Null(await db.Bookings.FindAsync(created.Id));
    }

    // ── Seat Capacity Validation ───────────────────────────────────────────────

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenSeatsExceedTableCapacity()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenSeatsExceedTableCapacity));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 5,
            Date = DateTime.UtcNow.AddDays(7)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("only has 4 seats", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_Succeeds_WhenSeatsEqualTableCapacity()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Succeeds_WhenSeatsEqualTableCapacity));
        TestSeed.BasicRestaurant(db);

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 4,
            Date = DateTime.UtcNow.AddDays(7)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal(4, result.Seats);
        Assert.NotEmpty(result.BookingRef!);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenTableExceedsConfiguredOversize()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(CreateBookingAsync_Throws_WhenTableExceedsConfiguredOversize));
        TestSeed.BasicRestaurant(db); // Table 1 has 4 seats.
        db.Restaurants.Single().MaxTableOversizeSeats = 1; // max 1 spare seat
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2, // 4-seat table for a party of 2 → 2 spare seats, over the cap of 1
            Date = DateTime.UtcNow.AddDays(7)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.CreateBookingAsync(dto));

        Assert.Contains("too large", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_AllowsTableAtOversizeBoundary()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(CreateBookingAsync_AllowsTableAtOversizeBoundary));
        TestSeed.BasicRestaurant(db); // Table 1 has 4 seats.
        db.Restaurants.Single().MaxTableOversizeSeats = 1; // max 1 spare seat
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 3, // 4-seat table for a party of 3 → 1 spare seat, at the cap
            Date = DateTime.UtcNow.AddDays(7)
        };

        BookingDto result = await svc.CreateBookingAsync(dto);

        Assert.Equal(3, result.Seats);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenBookingInPast()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenBookingInPast));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        var dto = new BookingDto { RestaurantId = 1, Date = DateTime.UtcNow.AddHours(-1) };
        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(dto));
    }

    [Fact]
    public async Task UpdateBookingAsync_SetsDefaultEndTime_WhenMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateBookingAsync_SetsDefaultEndTime_WhenMissing));
        TestSeed.BasicRestaurant(db);
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
    public async Task UpdateBookingAsync_Throws_WhenTableExceedsConfiguredOversize()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(UpdateBookingAsync_Throws_WhenTableExceedsConfiguredOversize));
        TestSeed.BasicRestaurant(db); // Table 1 has 4 seats.
        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddHours(1);
        BookingDto created = await svc.CreateBookingAsync(
            new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 4 });
        db.Entry((await db.Bookings.FindAsync(created.Id))!).State = EntityState.Detached;

        // Now cap spare seats at 1 and shrink the party to 2 → the 4-seat table is too large.
        db.Restaurants.Single().MaxTableOversizeSeats = 1;
        db.SaveChanges();

        var dto = new BookingDto
        {
            Id = created.Id,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = date,
            Seats = 2,
            EndTime = date.AddHours(1)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() =>
            svc.UpdateBookingAsync(created.Id, dto));

        Assert.Contains("too large", ex.Message);
    }

    [Fact]
    public async Task UpdateBookingAsync_FixesInvalidEndTime()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateBookingAsync_FixesInvalidEndTime));
        TestSeed.BasicRestaurant(db);
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
    public async Task UpdateBookingAsync_SetsDefaultEndTime_UsingRestaurantConfiguredDuration_WhenMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateBookingAsync_SetsDefaultEndTime_UsingRestaurantConfiguredDuration_WhenMissing));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", DefaultBookingDurationMinutes = 90 });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddHours(1);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 });
        db.Entry((await db.Bookings.FindAsync(created.Id))!).State = EntityState.Detached;

        var dto = new BookingDto { Id = created.Id, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2, EndTime = null };
        await svc.UpdateBookingAsync(created.Id, dto);
        Booking inDb = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        Assert.Equal(date.AddMinutes(90), inDb.EndTime);
    }

    [Fact]
    public async Task UpdateBookingAsync_FixesInvalidEndTime_UsingRestaurantConfiguredDuration()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateBookingAsync_FixesInvalidEndTime_UsingRestaurantConfiguredDuration));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", DefaultBookingDurationMinutes = 90 });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddHours(1);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, Seats = 2 });
        db.Entry((await db.Bookings.FindAsync(created.Id))!).State = EntityState.Detached;

        var dto = new BookingDto { Id = created.Id, RestaurantId = 1, SectionId = 1, TableId = 1, Date = date, EndTime = date.AddHours(-1), Seats = 2 };
        await svc.UpdateBookingAsync(created.Id, dto);
        Booking inDb = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        Assert.Equal(date.AddMinutes(90), inDb.EndTime);
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_ReturnsFalse_WhenNotFound));
        BookingService svc = CreateService(db);
        Assert.False(await svc.CancelBookingAsync("invalid", "test@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsFalse_WhenEmailMismatch()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_ReturnsFalse_WhenEmailMismatch));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "real@test.com", Seats = 2 });
        Assert.False(await svc.CancelBookingAsync(created.BookingRef!, "wrong@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_ReturnsTrue_WhenAlreadyCancelled()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_ReturnsTrue_WhenAlreadyCancelled));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "test@test.com", Seats = 2 });
        await svc.CancelBookingAsync(created.BookingRef!, "test@test.com");
        Assert.True(await svc.CancelBookingAsync(created.BookingRef!, "test@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_Throws_WhenBookingDateIsInThePast()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_Throws_WhenBookingDateIsInThePast));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "test@test.com", Seats = 2 });

        Booking booking = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        booking.Date = DateTime.UtcNow.AddHours(-1);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(
            () => svc.CancelBookingAsync(created.BookingRef!, "test@test.com"));

        Booking inDb = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        Assert.False(inDb.IsCancelled);
    }

    [Fact]
    public async Task CancelBookingAsync_Succeeds_WithinFiveMinuteGracePeriod()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_Succeeds_WithinFiveMinuteGracePeriod));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "test@test.com", Seats = 2 });

        Booking booking = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        booking.Date = DateTime.UtcNow.AddMinutes(-4);
        await db.SaveChangesAsync();

        Assert.True(await svc.CancelBookingAsync(created.BookingRef!, "test@test.com"));
    }

    [Fact]
    public async Task CancelBookingAsync_Throws_JustOutsideFiveMinuteGracePeriod()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CancelBookingAsync_Throws_JustOutsideFiveMinuteGracePeriod));
        TestSeed.BasicRestaurant(db);
        BookingService svc = CreateService(db);
        BookingDto created = await svc.CreateBookingAsync(new BookingDto { RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddHours(1), CustomerEmail = "test@test.com", Seats = 2 });

        Booking booking = await db.Bookings.FirstAsync(b => b.Id == created.Id);
        booking.Date = DateTime.UtcNow.AddMinutes(-6);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(
            () => svc.CancelBookingAsync(created.BookingRef!, "test@test.com"));
    }

    // ── Booking confirmation delegation ────────────────────────────────────────
    // The full email pipeline (template rendering, SMTP send, failure logging) now lives in
    // BookingConfirmationService (see BookingConfirmationServiceTests + EmailTemplateServiceTests).
    // BookingService's only responsibility here is the delegation seam.

    [Fact]
    public async Task CreateBookingAsync_DelegatesToConfirmationService_WhenProvided()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_DelegatesToConfirmationService_WhenProvided));
        TestSeed.BasicRestaurant(db);
        var confirmationMock = new Mock<IBookingConfirmationService>();
        BookingService svc = CreateService(db, confirmationService: confirmationMock.Object);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc),
        });

        Assert.NotEmpty(result.BookingRef!);
        // SendConfirmationAsync(Booking, Restaurant) called exactly once with the persisted booking.
        confirmationMock.Verify(
            c => c.SendConfirmationAsync(It.IsAny<Booking>(), It.IsAny<Restaurant>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateBookingAsync_Succeeds_WhenNoConfirmationServiceInjected()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Succeeds_WhenNoConfirmationServiceInjected));
        TestSeed.BasicRestaurant(db);
        // No IBookingConfirmationService — booking must still succeed (no email sent).
        BookingService svc = CreateService(db);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1, SectionId = 1, TableId = 1,
            CustomerEmail = "guest@example.com", Seats = 2,
            Date = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc),
        });

        Assert.NotEmpty(result.BookingRef!);
    }

    // ── Walk-in-only policy ───────────────────────────────────────────────────

    /// <summary>Next future occurrence of the given weekday, at 12:00 UTC.</summary>
    private static DateTime NextUtcOccurrence(DayOfWeek dayOfWeek)
    {
        DateTime d = DateTime.UtcNow.Date.AddDays(1);
        while (d.DayOfWeek != dayOfWeek)
        {
            d = d.AddDays(1);
        }

        return d.AddHours(12);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenLocationIsWalkInOnly()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenLocationIsWalkInOnly));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", WalkInOnly = true });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        };

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => svc.CreateBookingAsync(dto));
        Assert.Contains("walk-ins only", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingAsync_Throws_WhenDateFallsOnWalkInDay()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Throws_WhenDateFallsOnWalkInDay));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", Timezone = "UTC", WalkInDays = "6" });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        var dto = new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = NextUtcOccurrence(DayOfWeek.Saturday)
        };

        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(dto));
    }

    [Fact]
    public async Task CreateBookingAsync_Succeeds_OnNonWalkInDay()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_Succeeds_OnNonWalkInDay));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Test Restaurant", Timezone = "UTC", WalkInDays = "6" });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.SaveChanges();

        BookingService svc = CreateService(db);
        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = NextUtcOccurrence(DayOfWeek.Wednesday)
        });

        Assert.NotEmpty(result.BookingRef!);
    }

    // ── CreateBookingAsync — auto-assign ("Any section") ──────────────────────
    //
    // When TableId/SectionId are both null, the service picks the smallest fitting free
    // table across all sections, atomically places a hold, and persists the booking against
    // the resolved table. These tests cover each branch of that path.

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_PicksSmallestFittingFreeTable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_PicksSmallestFittingFreeTable));
        SeedMultiTableRestaurant(db);
        BookingService svc = CreateService(db);

        // 3 seats — fits T2(4)/T3(6)/P2(4) but not T1(2)/P1(2). Smallest fitting is T2.
        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 3,
            Date = DateTime.UtcNow.AddDays(7)
        });

        Assert.Equal(2, result.TableId); // T2 — smallest fitting free
        Assert.Equal(1, result.SectionId);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_RespectsMaxTableOversizeSeats()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(CreateBookingAsync_AutoAssign_RespectsMaxTableOversizeSeats));
        SeedMultiTableRestaurant(db); // T1(2), T2(4), T3(6), P1(2), P2(4)
        db.Restaurants.Single().MaxTableOversizeSeats = 1; // max 1 spare seat
        db.SaveChanges();
        BookingService svc = CreateService(db);

        // 2 seats — every table fits, but a 2-top may only take 1 spare seat, so only
        // T1(2)/P1(2) qualify (0 spare). T2/T3/P2 are excluded by the oversize cap.
        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7)
        });

        // Smallest fitting free table among the qualifying set — T1 (id 1, tiebreak over P1).
        Assert.Equal(1, result.TableId);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_ThrowsWhenOversizeExcludesAllCandidates()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(CreateBookingAsync_AutoAssign_ThrowsWhenOversizeExcludesAllCandidates));
        SeedMultiTableRestaurant(db); // T1(2), T2(4), T3(6), P1(2), P2(4)
        db.Restaurants.Single().MaxTableOversizeSeats = 0; // tables must seat the party exactly
        db.SaveChanges();
        BookingService svc = CreateService(db);

        // 3 seats — no 3-seat table exists, and an exact-fit is required (0 spare). No
        // candidate qualifies, so auto-assign reports no availability rather than seating
        // the party at an oversized table.
        await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 3,
            Date = DateTime.UtcNow.AddDays(7)
        }));
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_TiebreaksByTableId()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_TiebreaksByTableId));
        SeedMultiTableRestaurant(db);
        BookingService svc = CreateService(db);

        // 2 seats — both T1(2) and P1(2) fit. Tie-break by TableId: T1 (id 1) < P1 (id 4).
        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(8)
        });

        Assert.Equal(1, result.TableId);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_FallsThroughToNextTable_WhenFirstTaken()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_FallsThroughToNextTable_WhenFirstTaken));
        SeedMultiTableRestaurant(db);
        // Pre-book T1 (the smallest 2-seater) for the target date.
        DateTime date = DateTime.UtcNow.AddDays(9);
        db.Bookings.Add(new Booking
        {
            RestaurantId = 1, TableId = 1, SectionId = 1, Date = date,
            BookingRef = "PREBOOK", EndTime = date.AddMinutes(60)
        });
        db.SaveChanges();
        BookingService svc = CreateService(db);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = date
        });

        // T1 is taken; next smallest 2-seater is P1 (id 4).
        Assert.Equal(4, result.TableId);
        Assert.Equal(2, result.SectionId);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_CrossesSections_WhenSectionFull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_CrossesSections_WhenSectionFull));
        SeedMultiTableRestaurant(db);
        DateTime date = DateTime.UtcNow.AddDays(10);
        // Fill every Main-section table that fits 2 seats.
        foreach (int tid in new[] { 1, 2, 3 })
        {
            db.Bookings.Add(new Booking
            {
                RestaurantId = 1, TableId = tid, SectionId = 1, Date = date,
                BookingRef = $"PRE{tid}", EndTime = date.AddMinutes(60)
            });
        }
        db.SaveChanges();
        BookingService svc = CreateService(db);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = date
        });

        // All Main tables booked → auto-assign should land in Patio (section 2).
        Assert.Equal(2, result.SectionId);
        Assert.Equal(4, result.TableId); // P1, smallest Patio 2-seater
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_Throws_WhenNoEligibleTable()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_Throws_WhenNoEligibleTable));
        SeedMultiTableRestaurant(db);
        BookingService svc = CreateService(db);

        // 100 seats — no table fits.
        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 100,
            Date = DateTime.UtcNow.AddDays(11)
        }));

        Assert.Contains("No tables are available", ex.Message);
    }

    [Theory]
    [InlineData(null, 1)]   // TableId null, SectionId set
    [InlineData(1, null)]   // TableId set, SectionId null
    public async Task CreateBookingAsync_AutoAssign_Throws_WhenExactlyOneIdNull(int? tableId, int? sectionId)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_Throws_WhenExactlyOneIdNull) + $"_{tableId}_{sectionId}");
        SeedMultiTableRestaurant(db);
        BookingService svc = CreateService(db);

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            TableId = tableId,
            SectionId = sectionId,
            CustomerEmail = "guest@example.com",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(12)
        }));

        Assert.Contains("Specify both TableId and SectionId", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_AdoptsTableFromValidHold()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_AdoptsTableFromValidHold));
        SeedMultiTableRestaurant(db);
        DateTime date = DateTime.UtcNow.AddDays(13);

        // Simulate a pre-existing auto-assigned hold on T2 via a mocked IHoldService.
        // The service's ResolveAutoAssignAsync should adopt the held table/section without
        // running the candidate search.
        var holdMock = new Mock<IHoldService>();
        holdMock
            .Setup(h => h.GetHold("hold-T2"))
            .Returns(new HoldEntry("hold-T2", TableId: 2, SectionId: 1, RestaurantId: 1, Date: date, ExpiresAt: DateTime.UtcNow.AddMinutes(5)));
        holdMock.Setup(h => h.IsTableHeld(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>())).Returns(false);
        holdMock.Setup(h => h.ReleaseHold(It.IsAny<string>()));
        BookingService svc = new BookingService(
            new BookingRepository(db),
            new TableRepository(db),
            new SectionRepository(db),
            new RestaurantRepository(db),
            holdMock.Object,
            new BookingMapper(),
            new TableAutoAssigner(new BookingRepository(db)));

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "guest@example.com",
            Seats = 4,
            Date = date,
            HoldId = "hold-T2"
        });

        Assert.Equal(2, result.TableId); // adopted from the hold
        Assert.Equal(1, result.SectionId);
        // The candidate path must not have been invoked.
        holdMock.Verify(h => h.PlaceAutoHold(It.IsAny<int>(), It.IsAny<IReadOnlyList<TableCandidate>>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_PersistsResolvedTableOnBookingRow()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_PersistsResolvedTableOnBookingRow));
        SeedMultiTableRestaurant(db);
        BookingService svc = CreateService(db);
        DateTime date = DateTime.UtcNow.AddDays(14);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "persist@example.com",
            Seats = 2,
            Date = date
        });

        // Reload from DB to confirm the resolved table/section were persisted.
        Booking? persisted = await db.Bookings.FirstOrDefaultAsync(b => b.BookingRef == result.BookingRef);
        Assert.NotNull(persisted);
        Assert.Equal(result.TableId, persisted!.TableId);
        Assert.Equal(result.SectionId, persisted.SectionId);
    }
}
