using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class BookingNotificationServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public BookingNotificationServiceTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new AppDbContext(opts);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    private BookingNotificationService CreateService(VapidSettings? vapid = null)
    {
        vapid ??= new VapidSettings();
        return new BookingNotificationService(
            new AdminNotificationRepository(_db),
            new AdminPushSubscriptionRepository(_db),
            new TableRepository(_db),
            new BookingRepository(_db),
            Options.Create(vapid),
            NullLogger<BookingNotificationService>.Instance);
    }

    private async Task<Restaurant> SeedRestaurantAsync(int id = 1)
    {
        var r = new Restaurant { Id = id, Name = $"Restaurant {id}", Timezone = "UTC" };
        _db.Restaurants.Add(r);
        await _db.SaveChangesAsync();
        return r;
    }

    private static Booking MakeBooking(int restaurantId = 1) => new()
    {
        BookingRef = "ABC123",
        RestaurantId = restaurantId,
        CustomerName = "Alice",
        Seats = 2,
        Date = DateTime.UtcNow.AddDays(1),
    };

    // ── NotifyBookingCreatedAsync ─────────────────────────────────────────────

    [Fact]
    public async Task NotifyBookingCreatedAsync_CreatesNotification()
    {
        await SeedRestaurantAsync();
        var booking = MakeBooking();
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        await CreateService().NotifyBookingCreatedAsync(booking, "My Restaurant");

        AdminNotification? n = await _db.AdminNotifications.FirstOrDefaultAsync();
        Assert.NotNull(n);
        Assert.Equal(NotificationType.BookingCreated, n.Type);
        Assert.Equal("My Restaurant", n.RestaurantName);
        Assert.Equal("Alice", n.CustomerName);
        Assert.Equal(2, n.Seats);
        Assert.False(n.IsRead);
    }

    [Fact]
    public async Task NotifyBookingCreatedAsync_UsesGuestFallback_WhenCustomerNameNull()
    {
        await SeedRestaurantAsync();
        var booking = MakeBooking();
        booking.CustomerName = null;
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        await CreateService().NotifyBookingCreatedAsync(booking, "Resto");

        AdminNotification? n = await _db.AdminNotifications.FirstOrDefaultAsync();
        Assert.Equal("Guest", n!.CustomerName);
    }

    // ── NotifyBookingCancelledAsync ───────────────────────────────────────────

    [Fact]
    public async Task NotifyBookingCancelledAsync_CreatesNotification()
    {
        await SeedRestaurantAsync();
        var booking = MakeBooking();
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        await CreateService().NotifyBookingCancelledAsync(booking, "Resto");

        AdminNotification? n = await _db.AdminNotifications.FirstOrDefaultAsync();
        Assert.NotNull(n);
        Assert.Equal(NotificationType.BookingCancelled, n.Type);
    }

    [Fact]
    public async Task NotifyBookingCancelledAsync_UsesGuestFallback_WhenCustomerNameNull()
    {
        await SeedRestaurantAsync();
        var booking = MakeBooking();
        booking.CustomerName = null;
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        await CreateService().NotifyBookingCancelledAsync(booking, "Resto");

        AdminNotification? n = await _db.AdminNotifications.FirstOrDefaultAsync();
        Assert.Equal("Guest", n!.CustomerName);
    }

    // ── CheckAndNotifyCapacityAsync ───────────────────────────────────────────

    [Fact]
    public async Task CheckAndNotifyCapacityAsync_SkipsWhenNoTables()
    {
        await CreateService().CheckAndNotifyCapacityAsync(1, "Resto", DateTime.UtcNow);
        Assert.Empty(await _db.AdminNotifications.ToListAsync());
    }

    [Fact]
    public async Task CheckAndNotifyCapacityAsync_FiresWhenThresholdCrossed()
    {
        await SeedRestaurantAsync();
        var section = new Section { Name = "Main", RestaurantId = 1 };
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();
        for (int i = 0; i < 5; i++)
            _db.Tables.Add(new Table { Name = $"T{i}", Seats = 4, SectionId = section.Id });
        await _db.SaveChangesAsync();

        // 4/5 = 80% — just crosses the 0.8 threshold
        DateTime date = DateTime.UtcNow.Date.AddHours(12);
        int tableId = 1;
        foreach (Table t in await _db.Tables.ToListAsync())
        {
            if (tableId > 4) break;
            _db.Bookings.Add(new Booking
            {
                BookingRef = $"REF{tableId}",
                RestaurantId = 1,
                TableId = t.Id,
                Date = date,
                Seats = 2,
                IsCancelled = false,
            });
            tableId++;
        }
        await _db.SaveChangesAsync();

        await CreateService().CheckAndNotifyCapacityAsync(1, "Resto", date);

        AdminNotification? n = await _db.AdminNotifications.FirstOrDefaultAsync();
        Assert.NotNull(n);
        Assert.Equal(NotificationType.RestaurantNearlyFull, n.Type);
    }

    [Fact]
    public async Task CheckAndNotifyCapacityAsync_SkipsBelowThreshold()
    {
        await SeedRestaurantAsync();
        var section = new Section { Name = "Main", RestaurantId = 1 };
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();
        for (int i = 0; i < 5; i++)
            _db.Tables.Add(new Table { Name = $"T{i}", Seats = 4, SectionId = section.Id });
        await _db.SaveChangesAsync();

        // 3/5 = 60% — below 80% threshold
        DateTime date = DateTime.UtcNow.Date.AddHours(12);
        int count = 0;
        foreach (Table t in await _db.Tables.ToListAsync())
        {
            if (count >= 3) break;
            _db.Bookings.Add(new Booking { BookingRef = $"R{count}", RestaurantId = 1, TableId = t.Id, Date = date, Seats = 2, IsCancelled = false });
            count++;
        }
        await _db.SaveChangesAsync();

        await CreateService().CheckAndNotifyCapacityAsync(1, "Resto", date);

        Assert.Empty(await _db.AdminNotifications.ToListAsync());
    }

    [Fact]
    public async Task CheckAndNotifyCapacityAsync_DeduplicatesNearlyFull()
    {
        await SeedRestaurantAsync();
        var section = new Section { Name = "Main", RestaurantId = 1 };
        _db.Sections.Add(section);
        await _db.SaveChangesAsync();
        for (int i = 0; i < 5; i++)
            _db.Tables.Add(new Table { Name = $"T{i}", Seats = 4, SectionId = section.Id });
        await _db.SaveChangesAsync();

        DateTime date = DateTime.UtcNow.Date.AddHours(12);
        int count = 0;
        foreach (Table t in await _db.Tables.ToListAsync())
        {
            if (count >= 4) break;
            _db.Bookings.Add(new Booking { BookingRef = $"R{count}", RestaurantId = 1, TableId = t.Id, Date = date, Seats = 2, IsCancelled = false });
            count++;
        }
        // Seed an existing NearlyFull notification for today
        _db.AdminNotifications.Add(new AdminNotification
        {
            RestaurantId = 1,
            Type = NotificationType.RestaurantNearlyFull,
            BookingDate = date,
            BookingRef = string.Empty,
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await CreateService().CheckAndNotifyCapacityAsync(1, "Resto", date);

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
    }
}
