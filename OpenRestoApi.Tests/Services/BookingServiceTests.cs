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
        holdService ??= new Mock<IHoldService>().Object;
        return new BookingService(
            new BookingRepository(db),
            new TableRepository(db),
            new SectionRepository(db),
            new RestaurantRepository(db),
            holdService,
            new BookingMapper(),
            confirmationService);
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
}
