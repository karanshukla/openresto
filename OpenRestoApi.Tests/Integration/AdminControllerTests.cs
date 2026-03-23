using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class AdminControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public AdminControllerTests(TestWebAppFactory factory)
    {
        _factory = factory;
    }

    private (int restaurantId, int sectionId, int tableId) GetSeededIds()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();
        var section = db.Sections.First(s => s.RestaurantId == restaurant.Id);
        var table = db.Tables.First(t => t.SectionId == section.Id);
        return (restaurant.Id, section.Id, table.Id);
    }

    // ── Auth requirement ─────────────────────────────────────────────────────

    [Fact]
    public async Task Overview_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetBookings_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/admin/bookings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Overview ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Overview_ReturnsStats()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("totalRestaurants").GetInt32() >= 1);
    }

    // ── Bookings ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBookings_WithStatusFilter_ReturnsFiltered()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/admin/bookings?status=active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task CreateAdminBooking_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        var response = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(200).ToString("O"),
            customerEmail = "walkin@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("id").GetInt32() > 0);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("bookingRef").GetString()));
    }

    [Fact]
    public async Task CreateAdminBooking_DuplicateTableDate_ReturnsConflict()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var date = DateTime.UtcNow.AddDays(201).ToString("O");

        // First booking
        await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date, customerEmail = "first@test.com", seats = 2
        });

        // Duplicate
        var response = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date, customerEmail = "second@test.com", seats = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ExtendBooking_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // Create a booking to extend
        var createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = DateTime.UtcNow.AddDays(202).ToString("O"),
            customerEmail = "extend@test.com",
            seats = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetInt32();

        var response = await client.PostAsJsonAsync($"/api/admin/bookings/{bookingId}/extend", new
        {
            minutes = 30
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("endTime", out _));
    }

    [Fact]
    public async Task CancelBooking_SoftDelete_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // Create a booking to cancel
        var createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = DateTime.UtcNow.AddDays(203).ToString("O"),
            customerEmail = "cancel@test.com",
            seats = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync($"/api/admin/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it shows as cancelled
        var cancelledResp = await client.GetAsync("/api/admin/bookings?status=cancelled");
        var cancelledBody = await cancelledResp.Content.ReadFromJsonAsync<JsonElement>();
        var found = false;
        foreach (var b in cancelledBody.EnumerateArray())
        {
            if (b.GetProperty("id").GetInt32() == bookingId)
            {
                Assert.True(b.GetProperty("isCancelled").GetBoolean());
                found = true;
            }
        }
        Assert.True(found);
    }

    [Fact]
    public async Task PurgeBooking_HardDelete_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // Create a booking to purge
        var createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = DateTime.UtcNow.AddDays(204).ToString("O"),
            customerEmail = "purge@test.com",
            seats = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync($"/api/admin/bookings/{bookingId}/purge");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it's gone
        var getResp = await client.GetAsync($"/api/admin/bookings/{bookingId}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task CancelBooking_NonExistent_Returns404()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.DeleteAsync("/api/admin/bookings/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PurgeBooking_NonExistent_Returns404()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.DeleteAsync("/api/admin/bookings/99999/purge");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBooking_Patch_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // Create a booking
        var createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = DateTime.UtcNow.AddDays(205).ToString("O"),
            customerEmail = "patch@test.com",
            seats = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetInt32();

        // PATCH to update seats
        var patchContent = new StringContent(
            JsonSerializer.Serialize(new { seats = 4 }),
            Encoding.UTF8,
            "application/json");
        var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/bookings/{bookingId}")
        {
            Content = patchContent
        };
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(4, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task GetBookings_WithCancelledFilter_ReturnsCancelledOnly()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/admin/bookings?cancelled=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var b in body.EnumerateArray())
        {
            Assert.True(b.GetProperty("isCancelled").GetBoolean());
        }
    }

    [Fact]
    public async Task GetTables_ForRestaurant_ReturnsSections()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, _, _) = GetSeededIds();

        var response = await client.GetAsync($"/api/admin/restaurants/{restaurantId}/tables");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetArrayLength() >= 1);
    }
}
