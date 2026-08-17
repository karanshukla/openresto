using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// Real SQLite rather than the in-memory provider: the retention pass uses
/// <c>ExecuteDeleteAsync</c>, which the in-memory provider cannot translate.
/// </summary>
public class AdminAuditRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public AdminAuditRepositoryTests()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    public void Dispose()
    {
        _connection.Dispose();
        GC.SuppressFinalize(this);
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

    private static AdminAuditEntry Entry(
        string action,
        DateTime occurredAt,
        int? actorUserId = null,
        string? targetType = null,
        int? restaurantId = null) => new()
        {
            OccurredAt = occurredAt,
            ActorUserId = actorUserId,
            ActorEmail = "admin@test.com",
            ActorRole = UserRoles.Owner,
            Action = action,
            TargetType = targetType,
            RestaurantId = restaurantId,
            HttpMethod = "POST",
            Path = "/api/admin/test",
            StatusCode = 204,
        };

    private static readonly DateTime Noon = new(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task QueryPagedAsync_ReturnsNewestFirst()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);

        await repo.AddAsync(Entry(AuditActions.BookingCreate, Noon.AddHours(-2)));
        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon));
        await repo.AddAsync(Entry(AuditActions.BookingUpdate, Noon.AddHours(-1)));

        (List<AdminAuditEntry> items, int total) = await repo.QueryPagedAsync(new AuditQuery(), 1, 10);

        Assert.Equal(3, total);
        Assert.Equal(
            [AuditActions.BookingCancel, AuditActions.BookingUpdate, AuditActions.BookingCreate],
            items.Select(i => i.Action));
    }

    /// <summary>
    /// Entries written inside the same clock tick would otherwise page non-deterministically,
    /// dropping or repeating rows across a page boundary.
    /// </summary>
    [Fact]
    public async Task QueryPagedAsync_PagesDeterministically_WhenTimestampsCollide()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);

        for (int i = 0; i < 6; i++)
        {
            await repo.AddAsync(Entry(AuditActions.BookingCreate, Noon));
        }

        (List<AdminAuditEntry> firstPage, _) = await repo.QueryPagedAsync(new AuditQuery(), 1, 3);
        (List<AdminAuditEntry> secondPage, _) = await repo.QueryPagedAsync(new AuditQuery(), 2, 3);

        Assert.Equal([6, 5, 4], firstPage.Select(e => e.Id));
        Assert.Equal([3, 2, 1], secondPage.Select(e => e.Id));
    }

    [Fact]
    public async Task QueryPagedAsync_MatchesActionByPrefix()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);

        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon));
        await repo.AddAsync(Entry(AuditActions.BookingCreate, Noon));
        await repo.AddAsync(Entry(AuditActions.UserRoleChange, Noon));

        (List<AdminAuditEntry> group, _) = await repo.QueryPagedAsync(new AuditQuery { Action = "booking" }, 1, 10);
        (List<AdminAuditEntry> exact, _) = await repo.QueryPagedAsync(
            new AuditQuery { Action = AuditActions.BookingCancel }, 1, 10);

        Assert.Equal(2, group.Count);
        Assert.Single(exact);
    }

    /// <summary>
    /// Two real accounts, because <c>ActorUserId</c> is a real foreign key — filtering by actor
    /// against ids that reference nothing would prove less than it looks.
    /// </summary>
    private static async Task<(int First, int Second)> SeedActorsAsync(AppDbContext db)
    {
        var first = new AdminCredential { Email = "one@test.com", PasswordHash = "h", PasswordSalt = "s" };
        var second = new AdminCredential { Email = "two@test.com", PasswordHash = "h", PasswordSalt = "s" };
        db.AdminCredentials.AddRange(first, second);
        await db.SaveChangesAsync();
        return (first.Id, second.Id);
    }

    [Fact]
    public async Task QueryPagedAsync_FiltersByActorTargetAndRestaurant()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);
        (int first, int second) = await SeedActorsAsync(db);

        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon, actorUserId: first, targetType: AuditTargets.Booking, restaurantId: 5));
        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon, actorUserId: second, targetType: AuditTargets.Booking, restaurantId: 5));
        await repo.AddAsync(Entry(AuditActions.BrandUpdate, Noon, actorUserId: first, targetType: AuditTargets.Brand));

        (_, int byActor) = await repo.QueryPagedAsync(new AuditQuery { ActorUserId = first }, 1, 10);
        (_, int byTarget) = await repo.QueryPagedAsync(new AuditQuery { TargetType = AuditTargets.Booking }, 1, 10);
        (_, int byRestaurant) = await repo.QueryPagedAsync(new AuditQuery { RestaurantId = 5 }, 1, 10);

        Assert.Equal(2, byActor);
        Assert.Equal(2, byTarget);
        Assert.Equal(2, byRestaurant);
    }

    [Fact]
    public async Task QueryPagedAsync_FiltersByDateRangeInclusively()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);

        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon.AddDays(-2)));
        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon));
        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon.AddDays(2)));

        (_, int inRange) = await repo.QueryPagedAsync(
            new AuditQuery { From = Noon.AddDays(-1), To = Noon.AddDays(1) }, 1, 10);

        Assert.Equal(1, inRange);
    }

    [Fact]
    public async Task DeleteOlderThanAsync_RemovesOnlyEntriesBeforeTheCutoff()
    {
        using AppDbContext db = CreateContext();
        var repo = new AdminAuditRepository(db);

        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon.AddDays(-400)));
        await repo.AddAsync(Entry(AuditActions.BookingCancel, Noon.AddDays(-10)));

        int removed = await repo.DeleteOlderThanAsync(Noon.AddDays(-365));

        (_, int remaining) = await repo.QueryPagedAsync(new AuditQuery(), 1, 10);
        Assert.Equal(1, removed);
        Assert.Equal(1, remaining);
    }
}
