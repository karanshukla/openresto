using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// Real SQLite rather than the in-memory provider: the sweep uses <c>ExecuteUpdateAsync</c> and
/// <c>ExecuteDeleteAsync</c>, which the in-memory provider cannot translate.
/// </summary>
public class WaitlistRepositoryTests : IDisposable
{
    private static readonly DateTime Now = new(2026, 9, 26, 19, 0, 0, DateTimeKind.Utc);

    private readonly SqliteConnection _connection;

    public WaitlistRepositoryTests()
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
        if (db.Database.EnsureCreated())
        {
            db.Restaurants.AddRange(new Restaurant { Id = 1, Name = "One" }, new Restaurant { Id = 2, Name = "Two" });
            db.SaveChanges();
        }
        return db;
    }

    private static WaitlistEntry Entry(string entryRef, DateTime createdAt, WaitlistStatus status = WaitlistStatus.Waiting, int restaurantId = 1) => new()
    {
        RestaurantId = restaurantId,
        Ref = entryRef,
        Number = 1,
        Name = "Guest",
        Seats = 2,
        Status = status,
        CreatedAt = createdAt,
    };

    private async Task SeedAsync(params WaitlistEntry[] entries)
    {
        using AppDbContext db = CreateContext();
        db.WaitlistEntries.AddRange(entries);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetActiveForRestaurantAsync_ReturnsWaitingAndCalledParties_OldestFirst()
    {
        await SeedAsync(
            Entry("late", Now.AddMinutes(-5)),
            Entry("early", Now.AddMinutes(-30), WaitlistStatus.Notified),
            Entry("seated", Now.AddMinutes(-40), WaitlistStatus.Seated),
            Entry("left", Now.AddMinutes(-40), WaitlistStatus.Left),
            Entry("elsewhere", Now.AddMinutes(-50), restaurantId: 2));

        using AppDbContext db = CreateContext();
        List<WaitlistEntry> active = await new WaitlistRepository(db).GetActiveForRestaurantAsync(1);

        Assert.Equal(["early", "late"], active.Select(e => e.Ref));
    }

    [Fact]
    public async Task GetByRefAsync_And_GetByIdAsync_LoadTheRestaurant()
    {
        await SeedAsync(Entry("abc", Now));

        using AppDbContext db = CreateContext();
        var repo = new WaitlistRepository(db);
        WaitlistEntry? byRef = await repo.GetByRefAsync("abc");
        WaitlistEntry? byId = await repo.GetByIdAsync(byRef!.Id);

        Assert.Equal("One", byRef.Restaurant.Name);
        Assert.Equal("abc", byId!.Ref);
        Assert.Null(await repo.GetByRefAsync("missing"));
    }

    [Fact]
    public async Task CountCreatedSinceAsync_CountsEveryStatus_ForThatLocationOnly()
    {
        await SeedAsync(
            Entry("a", Now.AddHours(-1), WaitlistStatus.Seated),
            Entry("b", Now.AddMinutes(-5)),
            Entry("c", Now.AddDays(-1)),
            Entry("d", Now.AddMinutes(-5), restaurantId: 2));

        using AppDbContext db = CreateContext();

        Assert.Equal(2, await new WaitlistRepository(db).CountCreatedSinceAsync(1, Now.AddHours(-2)));
    }

    [Fact]
    public async Task AddAsync_PersistsTheEntry_WithItsStatusAsText()
    {
        using (AppDbContext db = CreateContext())
        {
            await new WaitlistRepository(db).AddAsync(Entry("new", Now, WaitlistStatus.Notified));
        }

        using AppDbContext check = CreateContext();
        string status = await check.Database
            .SqlQueryRaw<string>("SELECT Status AS Value FROM WaitlistEntries WHERE Ref = 'new'")
            .SingleAsync();
        Assert.Equal("Notified", status);
    }

    [Fact]
    public async Task ExpireActiveCreatedBeforeAsync_ExpiresOnlyStillQueuedEntries_BeforeTheCutoff()
    {
        DateTime cutoff = Now.AddHours(-6);
        await SeedAsync(
            Entry("stale", cutoff.AddSeconds(-1)),
            Entry("called-stale", cutoff.AddSeconds(-1), WaitlistStatus.Notified),
            Entry("at-cutoff", cutoff),
            Entry("seated-old", cutoff.AddHours(-1), WaitlistStatus.Seated));

        using (AppDbContext db = CreateContext())
        {
            Assert.Equal(2, await new WaitlistRepository(db).ExpireActiveCreatedBeforeAsync(cutoff, Now));
        }

        using AppDbContext check = CreateContext();
        Dictionary<string, WaitlistEntry> byRef = await check.WaitlistEntries.ToDictionaryAsync(e => e.Ref);
        Assert.Equal(WaitlistStatus.Expired, byRef["stale"].Status);
        Assert.Equal(Now, byRef["stale"].ClosedAt);
        Assert.Equal(WaitlistStatus.Expired, byRef["called-stale"].Status);
        Assert.Equal(WaitlistStatus.Waiting, byRef["at-cutoff"].Status);
        Assert.Equal(WaitlistStatus.Seated, byRef["seated-old"].Status);
    }

    [Fact]
    public async Task DeleteCreatedBeforeAsync_DeletesEveryStatus_BeforeTheCutoff()
    {
        DateTime cutoff = Now.AddDays(-7);
        await SeedAsync(
            Entry("old", cutoff.AddSeconds(-1), WaitlistStatus.Seated),
            Entry("at-cutoff", cutoff, WaitlistStatus.Left));

        using (AppDbContext db = CreateContext())
        {
            Assert.Equal(1, await new WaitlistRepository(db).DeleteCreatedBeforeAsync(cutoff));
        }

        using AppDbContext check = CreateContext();
        Assert.Equal(["at-cutoff"], await check.WaitlistEntries.Select(e => e.Ref).ToListAsync());
    }

    [Fact]
    public async Task PurgingTheSeatedBooking_KeepsTheEntry_AndClearsTheLink()
    {
        using (AppDbContext db = CreateContext())
        {
            var booking = new Booking { RestaurantId = 1, Seats = 2, BookingRef = "bk", Date = Now };
            db.Bookings.Add(booking);
            await db.SaveChangesAsync();
            WaitlistEntry entry = Entry("seated", Now, WaitlistStatus.Seated);
            entry.BookingId = booking.Id;
            db.WaitlistEntries.Add(entry);
            await db.SaveChangesAsync();
        }

        using (AppDbContext db = CreateContext())
        {
            await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON; DELETE FROM Bookings;");
        }

        using AppDbContext check = CreateContext();
        WaitlistEntry kept = await check.WaitlistEntries.SingleAsync();
        Assert.Null(kept.BookingId);
    }
}
