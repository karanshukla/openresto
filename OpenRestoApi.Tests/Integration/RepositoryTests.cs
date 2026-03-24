using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Integration;

public class RepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public RepositoryTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private AppDbContext CreateContext()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private (Restaurant restaurant, Section section, Table table) SeedRestaurantData(AppDbContext db)
    {
        var restaurant = new Restaurant
        {
            Name = "Test Restaurant",
            Address = "1 Test Rd",
            Sections = new List<Section>
            {
                new Section
                {
                    Name = "Main Hall",
                    Tables = new List<Table>
                    {
                        new Table { Name = "A1", Seats = 4 },
                        new Table { Name = "A2", Seats = 2 }
                    }
                }
            }
        };
        db.Restaurants.Add(restaurant);
        db.SaveChanges();

        Section section = restaurant.Sections.First();
        Table table = section.Tables.First();
        return (restaurant, section, table);
    }

    // ─── BookingRepository ───────────────────────────────────────────

    [Fact]
    public async Task BookingRepository_AddAsync_CreatesBooking()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        var booking = new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(1),
            CustomerEmail = "test@test.com",
            Seats = 2,
            BookingRef = "REF001"
        };

        Booking result = await repo.AddAsync(booking);

        Assert.True(result.Id > 0);
        Assert.Equal("REF001", result.BookingRef);
    }

    [Fact]
    public async Task BookingRepository_GetByIdAsync_ReturnsBookingWithIncludes()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        var booking = new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(2),
            CustomerEmail = "includes@test.com",
            Seats = 3,
            BookingRef = "REF002"
        };
        await repo.AddAsync(booking);

        // Detach all entities so that GetByIdAsync has to load from DB with includes
        db.ChangeTracker.Clear();

        Booking? result = await repo.GetByIdAsync(booking.Id);

        Assert.NotNull(result);
        Assert.Equal("REF002", result!.BookingRef);
        Assert.NotNull(result.Table);
        Assert.Equal("A1", result.Table.Name);
        Assert.NotNull(result.Section);
        Assert.Equal("Main Hall", result.Section.Name);
        Assert.NotNull(result.Restaurant);
        Assert.Equal("Test Restaurant", result.Restaurant.Name);
    }

    [Fact]
    public async Task BookingRepository_GetByRefAsync_ReturnsCorrectBooking()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        var booking = new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(3),
            CustomerEmail = "ref@test.com",
            Seats = 2,
            BookingRef = "UNIQUE-REF"
        };
        await repo.AddAsync(booking);
        db.ChangeTracker.Clear();

        Booking? result = await repo.GetByRefAsync("UNIQUE-REF");

        Assert.NotNull(result);
        Assert.Equal("ref@test.com", result!.CustomerEmail);
    }

    [Fact]
    public async Task BookingRepository_GetByRefAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateContext();
        SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        Booking? result = await repo.GetByRefAsync("NONEXISTENT");

        Assert.Null(result);
    }

    [Fact]
    public async Task BookingRepository_GetBookingsByRestaurantIdAsync_ReturnsOnlyMatchingBookings()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        Table table2 = section.Tables.Last();

        await repo.AddAsync(new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(4),
            CustomerEmail = "a@test.com",
            Seats = 2,
            BookingRef = "RESTA1"
        });
        await repo.AddAsync(new Booking
        {
            TableId = table2.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(5),
            CustomerEmail = "b@test.com",
            Seats = 2,
            BookingRef = "RESTA2"
        });

        var results = (await repo.GetBookingsByRestaurantIdAsync(restaurant.Id)).ToList();

        Assert.Equal(2, results.Count);
        Assert.All(results, b => Assert.Equal(restaurant.Id, b.RestaurantId));
    }

    [Fact]
    public async Task BookingRepository_DeleteAsync_RemovesBooking()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        var booking = new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = DateTime.UtcNow.AddDays(6),
            CustomerEmail = "delete@test.com",
            Seats = 1,
            BookingRef = "DEL001"
        };
        await repo.AddAsync(booking);

        await repo.DeleteAsync(booking.Id);

        Booking? result = await repo.GetByIdAsync(booking.Id);
        Assert.Null(result);
    }

    [Fact]
    public async Task BookingRepository_IsTableBookedOnDateAsync_ReturnsTrue_WhenOverlap()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        DateTime bookingDate = DateTime.UtcNow.Date.AddDays(7).AddHours(12).ToUniversalTime();

        await repo.AddAsync(new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = bookingDate,
            EndTime = bookingDate.AddHours(1),
            CustomerEmail = "booked@test.com",
            Seats = 2,
            BookingRef = "OVERLAP1"
        });

        // Check at a time that overlaps (30 minutes into the existing booking)
        bool isBooked = await repo.IsTableBookedOnDateAsync(table.Id, bookingDate.AddMinutes(30));

        Assert.True(isBooked);
    }

    [Fact]
    public async Task BookingRepository_IsTableBookedOnDateAsync_ReturnsFalse_WhenNoOverlap()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        DateTime bookingDate = DateTime.UtcNow.Date.AddDays(8).AddHours(12).ToUniversalTime();

        await repo.AddAsync(new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = bookingDate,
            EndTime = bookingDate.AddHours(1),
            CustomerEmail = "nooverlap@test.com",
            Seats = 2,
            BookingRef = "NOOVERLAP1"
        });

        // Check at a time well after the existing booking ends
        bool isBooked = await repo.IsTableBookedOnDateAsync(table.Id, bookingDate.AddHours(2));

        Assert.False(isBooked);
    }

    [Fact]
    public async Task BookingRepository_IsTableBookedOnDateAsync_ReturnsFalse_WhenCancelled()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section? section, Table? table) = SeedRestaurantData(db);
        var repo = new BookingRepository(db);

        DateTime bookingDate = DateTime.UtcNow.Date.AddDays(9).AddHours(12).ToUniversalTime();

        await repo.AddAsync(new Booking
        {
            TableId = table.Id,
            SectionId = section.Id,
            RestaurantId = restaurant.Id,
            Date = bookingDate,
            EndTime = bookingDate.AddHours(1),
            CustomerEmail = "cancelled@test.com",
            Seats = 2,
            BookingRef = "CANCELLED1",
            IsCancelled = true,
            CancelledAt = DateTime.UtcNow
        });

        // Same time as the cancelled booking — should be available
        bool isBooked = await repo.IsTableBookedOnDateAsync(table.Id, bookingDate);

        Assert.False(isBooked);
    }

    // ─── RestaurantRepository ────────────────────────────────────────

    [Fact]
    public async Task RestaurantRepository_GetByIdAsync_LoadsSectionsAndTables()
    {
        using AppDbContext db = CreateContext();
        (Restaurant? restaurant, Section _, Table _) = SeedRestaurantData(db);
        db.ChangeTracker.Clear();
        var repo = new RestaurantRepository(db);

        Restaurant? result = await repo.GetByIdAsync(restaurant.Id);

        Assert.NotNull(result);
        Assert.Equal("Test Restaurant", result!.Name);
        Assert.Single(result.Sections);

        Section section = result.Sections.First();
        Assert.Equal("Main Hall", section.Name);
        Assert.Equal(2, section.Tables.Count);
    }

    [Fact]
    public async Task RestaurantRepository_GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateContext();
        var repo = new RestaurantRepository(db);

        Restaurant? result = await repo.GetByIdAsync(9999);

        Assert.Null(result);
    }

    // ─── SectionRepository ───────────────────────────────────────────

    [Fact]
    public async Task SectionRepository_GetByIdAsync_ReturnsSection()
    {
        using AppDbContext db = CreateContext();
        (Restaurant _, Section? section, Table _) = SeedRestaurantData(db);
        db.ChangeTracker.Clear();
        var repo = new SectionRepository(db);

        Section? result = await repo.GetByIdAsync(section.Id);

        Assert.NotNull(result);
        Assert.Equal("Main Hall", result!.Name);
    }

    [Fact]
    public async Task SectionRepository_GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateContext();
        var repo = new SectionRepository(db);

        Section? result = await repo.GetByIdAsync(9999);

        Assert.Null(result);
    }

    // ─── TableRepository ─────────────────────────────────────────────

    [Fact]
    public async Task TableRepository_GetByIdAsync_ReturnsTable()
    {
        using AppDbContext db = CreateContext();
        (Restaurant _, Section _, Table? table) = SeedRestaurantData(db);
        db.ChangeTracker.Clear();
        var repo = new TableRepository(db);

        Table? result = await repo.GetByIdAsync(table.Id);

        Assert.NotNull(result);
        Assert.Equal("A1", result!.Name);
        Assert.Equal(4, result.Seats);
    }

    [Fact]
    public async Task TableRepository_GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateContext();
        var repo = new TableRepository(db);

        Table? result = await repo.GetByIdAsync(9999);

        Assert.Null(result);
    }
}
