using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Issue #319 Phase 2: <c>BookingsController</c>'s admin-only reads (<c>GetBookingByIdAsync</c>,
/// <c>GetBookingsByRestaurantAsync</c>) must redact guest identity for an API key holding
/// <c>bookings:read</c> without <c>guests:read</c>. <c>GetBookingByRefAsync</c> is the customer's
/// own unauthenticated lookup and is pinned elsewhere to never redact.
/// </summary>
public partial class BookingServiceTests
{
    [Fact]
    public async Task GetBookingByIdAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByIdAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead));
        TestSeed.BasicRestaurant(db);
        BookingService plain = CreateService(db);
        BookingDto created = await plain.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            CustomerName = "Guest Name",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
        });

        BookingService svc = CreateService(db, currentUser: FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));
        BookingDto? result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Null(result!.CustomerName);
        Assert.Null(result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsFullGuestFields_ForAnApiKeyWithGuestsRead()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByIdAsync_ReturnsFullGuestFields_ForAnApiKeyWithGuestsRead));
        TestSeed.BasicRestaurant(db);
        BookingService plain = CreateService(db);
        BookingDto created = await plain.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            CustomerName = "Guest Name",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
        });

        BookingService svc = CreateService(db, currentUser: FakeCurrentUser.ApiKey(
            (ApiKeyScopes.Bookings, ApiKeyScopes.Read),
            (ApiKeyScopes.Guests, ApiKeyScopes.Read)));
        BookingDto? result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal("Guest Name", result!.CustomerName);
        Assert.Equal("guest@example.com", result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingByIdAsync_ReturnsFullGuestFields_ForAJwtSession()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByIdAsync_ReturnsFullGuestFields_ForAJwtSession));
        TestSeed.BasicRestaurant(db);
        BookingService plain = CreateService(db);
        BookingDto created = await plain.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            CustomerName = "Guest Name",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
        });

        BookingService svc = CreateService(db, currentUser: FakeCurrentUser.Anonymous());
        BookingDto? result = await svc.GetBookingByIdAsync(created.Id);

        Assert.NotNull(result);
        Assert.Equal("Guest Name", result!.CustomerName);
        Assert.Equal("guest@example.com", result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingByRefAsync_NeverRedacts_EvenForAnApiKeyWithoutGuestsRead()
    {
        // The customer's own unauthenticated lookup must always see their own details — this
        // deliberately does not route through BookingGuestVisibility.
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingByRefAsync_NeverRedacts_EvenForAnApiKeyWithoutGuestsRead));
        TestSeed.BasicRestaurant(db);
        BookingService plain = CreateService(db);
        BookingDto created = await plain.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            CustomerName = "Guest Name",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
        });

        BookingService svc = CreateService(db, currentUser: FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));
        BookingDto? result = await svc.GetBookingByRefAsync(created.BookingRef!);

        Assert.NotNull(result);
        Assert.Equal("Guest Name", result!.CustomerName);
        Assert.Equal("guest@example.com", result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingsByRestaurantAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetBookingsByRestaurantAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead));
        TestSeed.BasicRestaurant(db);
        BookingService plain = CreateService(db);
        await plain.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            CustomerEmail = "guest@example.com",
            CustomerName = "Guest Name",
            Seats = 2,
            Date = DateTime.UtcNow.AddDays(7),
        });

        BookingService svc = CreateService(db, currentUser: FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));
        var results = (await svc.GetBookingsByRestaurantAsync(1)).ToList();

        Assert.NotEmpty(results);
        Assert.All(results, r => Assert.Null(r.CustomerName));
        Assert.All(results, r => Assert.Null(r.CustomerEmail));
    }
}
