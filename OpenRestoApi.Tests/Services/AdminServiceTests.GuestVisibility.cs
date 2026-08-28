using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Issue #319 Phase 2: an API key holding <c>bookings:read</c> but not <c>guests:read</c> must
/// never see who a booking belongs to. Every path below returns a <see cref="BookingDetailDto"/>
/// through <c>AdminService.ToDetailDto</c>, the one choke point <see cref="BookingGuestVisibility"/>
/// is applied at.
/// </summary>
public partial class AdminServiceTests
{
    private void SeedOneBooking(int id = 1, string name = "Alice Smith", string email = "alice@example.com")
    {
        _db.Bookings.Add(new Booking
        {
            Id = id,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = DateTime.UtcNow,
            BookingRef = $"REF{id}",
            CustomerName = name,
            CustomerEmail = email,
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task GetBookingAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead()
    {
        SeedBase();
        SeedOneBooking();
        AdminService svc = CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));

        BookingDetailDto? result = await svc.GetBookingAsync(1);

        Assert.NotNull(result);
        Assert.Null(result!.CustomerName);
        Assert.Null(result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingAsync_ReturnsFullGuestFields_ForAnApiKeyWithGuestsRead()
    {
        SeedBase();
        SeedOneBooking();
        AdminService svc = CreateService(FakeCurrentUser.ApiKey(
            (ApiKeyScopes.Bookings, ApiKeyScopes.Read),
            (ApiKeyScopes.Guests, ApiKeyScopes.Read)));

        BookingDetailDto? result = await svc.GetBookingAsync(1);

        Assert.NotNull(result);
        Assert.Equal("Alice Smith", result!.CustomerName);
        Assert.Equal("alice@example.com", result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingAsync_ReturnsFullGuestFields_ForAJwtSession()
    {
        SeedBase();
        SeedOneBooking();
        AdminService svc = CreateService(FakeCurrentUser.Anonymous());

        BookingDetailDto? result = await svc.GetBookingAsync(1);

        Assert.NotNull(result);
        Assert.Equal("Alice Smith", result!.CustomerName);
        Assert.Equal("alice@example.com", result.CustomerEmail);
    }

    [Fact]
    public async Task GetBookingsAsync_RedactsGuestFields_ForAnApiKeyWithoutGuestsRead()
    {
        SeedBase();
        SeedOneBooking();
        AdminService svc = CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));

        List<BookingDetailDto> results = await svc.GetBookingsAsync(1, null, "all");

        Assert.All(results, r => Assert.Null(r.CustomerName));
        Assert.All(results, r => Assert.Null(r.CustomerEmail));
    }

    [Fact]
    public async Task GetBookingsAsync_EmailSearch_StillFiltersCorrectly_ButRedactsTheMatchedRow()
    {
        // A search by an email the caller already supplied still has to find the right booking —
        // redaction only hides the *display* fields on the result, it must never make the filter
        // itself silently wrong (see the task's "sane, not silently wrong" requirement).
        SeedBase();
        SeedOneBooking(1, "Alice Smith", "alice@example.com");
        SeedOneBooking(2, "Bob Jones", "bob@example.com");
        AdminService svc = CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));

        List<BookingDetailDto> results = await svc.GetBookingsAsync(1, null, "all", email: "alice");

        BookingDetailDto match = Assert.Single(results);
        Assert.Equal(1, match.Id);
        Assert.Null(match.CustomerName);
        Assert.Null(match.CustomerEmail);
    }

    [Fact]
    public async Task GetOverviewAsync_RedactsGuestFieldsOnTodaysBookingsList_ForAnApiKeyWithoutGuestsRead()
    {
        SeedBase();
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = DateTime.UtcNow,
            BookingRef = "REF1",
            CustomerName = "Alice Smith",
            CustomerEmail = "alice@example.com",
        });
        _db.SaveChanges();
        AdminService svc = CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));

        AdminOverviewDto overview = await svc.GetOverviewAsync();

        Assert.NotEmpty(overview.TodayBookingsList);
        Assert.All(overview.TodayBookingsList, b => Assert.Null(b.CustomerName));
        Assert.All(overview.TodayBookingsList, b => Assert.Null(b.CustomerEmail));
    }

    [Fact]
    public async Task CreateBookingAsync_RedactsGuestFieldsOnTheReturnedDto_ForAnApiKeyWithoutGuestsRead()
    {
        SeedBase();
        _db.SaveChanges();
        AdminService svc = CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Write)));

        BookingDetailDto result = await svc.CreateBookingAsync(new AdminCreateBookingRequest
        {
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Date = DateTime.UtcNow.AddHours(1),
            CustomerEmail = "new@example.com",
            CustomerName = "New Guest",
            Seats = 2,
        });

        Assert.Null(result.CustomerName);
        Assert.Null(result.CustomerEmail);
    }
}
