using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class NotificationServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public NotificationServiceTests()
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

    private NotificationService CreateService(VapidSettings? vapid = null)
    {
        vapid ??= new VapidSettings();
        return new NotificationService(
            new AdminNotificationRepository(_db),
            new AdminPushSubscriptionRepository(_db),
            Options.Create(vapid),
            NullLogger<NotificationService>.Instance);
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

    // ── GetVapidPublicKey ─────────────────────────────────────────────────────

    [Fact]
    public void GetVapidPublicKey_ReturnsNull_WhenNotConfigured()
    {
        Assert.Null(CreateService().GetVapidPublicKey());
    }

    [Fact]
    public void GetVapidPublicKey_ReturnsPublicKey_WhenConfigured()
    {
        var svc = CreateService(new VapidSettings
        {
            PublicKey = "my-public-key",
            PrivateKey = "my-private-key",
            Subject = "mailto:a@b.com"
        });
        Assert.Equal("my-public-key", svc.GetVapidPublicKey());
    }

    // Booking-event and capacity-threshold notification tests moved to
    // BookingNotificationServiceTests (those methods now live on IBookingNotificationService,
    // consumed by the background NotificationWorker — no longer on the controller-facing
    // INotificationService surface tested here).

    // ── GetNotificationsAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task GetNotificationsAsync_ReturnsAll_WhenNoFilter()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCreated, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, Type = NotificationType.BookingCancelled, BookingRef = "B", IsRead = true, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        (List<AdminNotificationDto> items, int total) = await CreateService().GetNotificationsAsync(null, null, null, 1, 20);

        Assert.Equal(2, total);
        Assert.Equal(2, items.Count);
    }

    [Fact]
    public async Task GetNotificationsAsync_FiltersUnreadOnly()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCreated, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCancelled, BookingRef = "B", IsRead = true, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        (List<AdminNotificationDto> items, int total) = await CreateService().GetNotificationsAsync(null, null, true, 1, 20);

        Assert.Equal(1, total);
        Assert.All(items, i => Assert.False(i.IsRead));
    }

    [Fact]
    public async Task GetNotificationsAsync_FiltersRestaurantId()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCreated, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, Type = NotificationType.BookingCreated, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        (List<AdminNotificationDto> items, int total) = await CreateService().GetNotificationsAsync(1, null, null, 1, 20);

        Assert.Equal(1, total);
        Assert.All(items, i => Assert.Equal(1, i.RestaurantId));
    }

    [Fact]
    public async Task GetNotificationsAsync_FiltersType()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCreated, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, Type = NotificationType.BookingCancelled, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        (List<AdminNotificationDto> items, int total) = await CreateService().GetNotificationsAsync(null, NotificationType.BookingCreated, null, 1, 20);

        Assert.Equal(1, total);
        Assert.All(items, i => Assert.Equal(NotificationType.BookingCreated, i.Type));
    }

    [Fact]
    public async Task GetNotificationsAsync_PaginatesResults()
    {
        await SeedRestaurantAsync();
        for (int i = 0; i < 5; i++)
            _db.AdminNotifications.Add(new AdminNotification
            {
                RestaurantId = 1,
                Type = NotificationType.BookingCreated,
                BookingRef = $"R{i}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddSeconds(i)
            });
        await _db.SaveChangesAsync();

        (List<AdminNotificationDto> page1, int total) = await CreateService().GetNotificationsAsync(null, null, null, 1, 3);

        Assert.Equal(5, total);
        Assert.Equal(3, page1.Count);
    }

    // ── GetUnreadCountAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetUnreadCountAsync_CountsAllUnread_WhenNoRestaurantFilter()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, BookingRef = "C", IsRead = true, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        int count = await CreateService().GetUnreadCountAsync(null);
        Assert.Equal(2, count);
    }

    [Fact]
    public async Task GetUnreadCountAsync_FiltersRestaurant()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        int count = await CreateService().GetUnreadCountAsync(1);
        Assert.Equal(1, count);
    }

    // ── MarkReadAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkReadAsync_SetsIsReadTrue()
    {
        await SeedRestaurantAsync();
        var n = new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow };
        _db.AdminNotifications.Add(n);
        await _db.SaveChangesAsync();

        await CreateService().MarkReadAsync(n.Id);

        await _db.Entry(n).ReloadAsync();
        Assert.True(n.IsRead);
    }

    [Fact]
    public async Task MarkReadAsync_NoOp_WhenAlreadyRead()
    {
        await SeedRestaurantAsync();
        var n = new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = true, CreatedAt = DateTime.UtcNow };
        _db.AdminNotifications.Add(n);
        await _db.SaveChangesAsync();

        await CreateService().MarkReadAsync(n.Id);

        await _db.Entry(n).ReloadAsync();
        Assert.True(n.IsRead);
    }

    [Fact]
    public async Task MarkReadAsync_NoOp_WhenNotFound()
    {
        // Should not throw
        await CreateService().MarkReadAsync(9999);
    }

    // ── MarkAllReadAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task MarkAllReadAsync_MarksAllUnreadForRestaurant()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, BookingRef = "C", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        await CreateService().MarkAllReadAsync(1);

        Assert.Equal(0, await _db.AdminNotifications.CountAsync(n => n.RestaurantId == 1 && !n.IsRead));
        Assert.Equal(1, await _db.AdminNotifications.CountAsync(n => n.RestaurantId == 2 && !n.IsRead));
    }

    // ── SubscribeAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task SubscribeAsync_CreatesNewSubscription()
    {
        await SeedRestaurantAsync();
        await CreateService().SubscribeAsync(1, new PushSubscribeRequest("https://ep", "p256", "auth"));

        Assert.Equal(1, await _db.AdminPushSubscriptions.CountAsync());
        AdminPushSubscription sub = await _db.AdminPushSubscriptions.FirstAsync();
        Assert.Equal("https://ep", sub.Endpoint);
        Assert.Equal(1, sub.RestaurantId);
    }

    [Fact]
    public async Task SubscribeAsync_UpdatesExistingSubscription()
    {
        await SeedRestaurantAsync();
        _db.AdminPushSubscriptions.Add(new AdminPushSubscription
        {
            RestaurantId = 1,
            Endpoint = "https://ep",
            P256dh = "old-p256",
            Auth = "old-auth",
            CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        await CreateService().SubscribeAsync(1, new PushSubscribeRequest("https://ep", "new-p256", "new-auth"));

        Assert.Equal(1, await _db.AdminPushSubscriptions.CountAsync());
        AdminPushSubscription sub = await _db.AdminPushSubscriptions.FirstAsync();
        Assert.Equal("new-p256", sub.P256dh);
        Assert.Equal("new-auth", sub.Auth);
    }

    // ── UnsubscribeAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task UnsubscribeAsync_RemovesAllMatchingEndpoints()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminPushSubscriptions.AddRange(
            new AdminPushSubscription { RestaurantId = 1, Endpoint = "https://ep", P256dh = "p", Auth = "a", CreatedAt = DateTime.UtcNow },
            new AdminPushSubscription { RestaurantId = 2, Endpoint = "https://ep", P256dh = "p", Auth = "a", CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        await CreateService().UnsubscribeAsync("https://ep");

        Assert.Equal(0, await _db.AdminPushSubscriptions.CountAsync());
    }

    [Fact]
    public async Task UnsubscribeAsync_NoOp_WhenNotFound()
    {
        // Should not throw
        await CreateService().UnsubscribeAsync("https://not-found");
    }

    // ── DeleteByIdAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteByIdAsync_RemovesExistingNotification()
    {
        await SeedRestaurantAsync();
        var n = new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow };
        _db.AdminNotifications.Add(n);
        await _db.SaveChangesAsync();

        await CreateService().DeleteByIdAsync(n.Id);

        Assert.Equal(0, await _db.AdminNotifications.CountAsync());
    }

    [Fact]
    public async Task DeleteByIdAsync_NoOp_WhenNotFound()
    {
        await CreateService().DeleteByIdAsync(9999);
    }

    // ── DeleteByIdsAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteByIdsAsync_RemovesSpecifiedIds()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, BookingRef = "C", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        List<int> ids = await _db.AdminNotifications
            .Where(n => n.BookingRef == "A" || n.BookingRef == "B")
            .Select(n => n.Id)
            .ToListAsync();

        await CreateService().DeleteByIdsAsync(ids);

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
        Assert.Equal("C", (await _db.AdminNotifications.FirstAsync()).BookingRef);
    }

    [Fact]
    public async Task DeleteByIdsAsync_NoOp_WhenEmptyList()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.Add(new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        await CreateService().DeleteByIdsAsync(new List<int>());

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
    }

    // ── DeleteAllAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAllAsync_DeletesAll_WhenNoFilter()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow, Type = NotificationType.BookingCreated },
            new AdminNotification { RestaurantId = 2, BookingRef = "B", IsRead = true, CreatedAt = DateTime.UtcNow, Type = NotificationType.BookingCancelled }
        );
        await _db.SaveChangesAsync();

        await CreateService().DeleteAllAsync(null, null, null);

        Assert.Equal(0, await _db.AdminNotifications.CountAsync());
    }

    [Fact]
    public async Task DeleteAllAsync_FiltersRestaurantId()
    {
        await SeedRestaurantAsync(1);
        await SeedRestaurantAsync(2);
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 2, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        await CreateService().DeleteAllAsync(1, null, null);

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
        Assert.Equal(2, (await _db.AdminNotifications.FirstAsync()).RestaurantId);
    }

    [Fact]
    public async Task DeleteAllAsync_FiltersType()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow, Type = NotificationType.BookingCreated },
            new AdminNotification { RestaurantId = 1, BookingRef = "B", IsRead = false, CreatedAt = DateTime.UtcNow, Type = NotificationType.BookingCancelled }
        );
        await _db.SaveChangesAsync();

        await CreateService().DeleteAllAsync(null, NotificationType.BookingCreated, null);

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
        Assert.Equal(NotificationType.BookingCancelled, (await _db.AdminNotifications.FirstAsync()).Type);
    }

    [Fact]
    public async Task DeleteAllAsync_FiltersUnreadOnly()
    {
        await SeedRestaurantAsync();
        _db.AdminNotifications.AddRange(
            new AdminNotification { RestaurantId = 1, BookingRef = "A", IsRead = false, CreatedAt = DateTime.UtcNow },
            new AdminNotification { RestaurantId = 1, BookingRef = "B", IsRead = true, CreatedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        await CreateService().DeleteAllAsync(null, null, true);

        Assert.Equal(1, await _db.AdminNotifications.CountAsync());
        Assert.True((await _db.AdminNotifications.FirstAsync()).IsRead);
    }
}
