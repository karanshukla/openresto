using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class BookingsControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public BookingsControllerTests(TestWebAppFactory factory)
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

    [Fact]
    public async Task CreateBooking_Returns201WithBookingRef()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // First place a hold
        var holdResponse = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(10).ToString("O")
        });
        var holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(10).ToString("O"),
            customerEmail = "customer@test.com",
            seats = 2,
            holdId
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("bookingRef").GetString()));
    }

    [Fact]
    public async Task CreateBooking_DuplicateTable_ReturnsConflict()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var bookingDate = DateTime.UtcNow.AddDays(20).ToString("O");

        // First place a hold and create booking
        var holdResponse = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        var holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "first@test.com",
            seats = 2,
            holdId
        });

        // Try to book same table on same date
        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "second@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetBookingByRef_WithCorrectEmail_ReturnsBooking()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var bookingDate = DateTime.UtcNow.AddDays(30).ToString("O");

        // Place hold + create booking
        var holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        var holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        var createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "lookup@test.com",
            seats = 3,
            holdId
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingRef = created.GetProperty("bookingRef").GetString();

        // Look up by ref
        var response = await client.GetAsync($"/api/bookings/ref/{bookingRef}?email=lookup@test.com");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(bookingRef, body.GetProperty("bookingRef").GetString());
    }

    [Fact]
    public async Task GetBookingByRef_WithWrongEmail_Returns404()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        // Use a different table to avoid conflicts — get second table
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var table2 = db.Tables.Where(t => t.SectionId == sectionId).Skip(1).First();

        var bookingDate = DateTime.UtcNow.AddDays(31).ToString("O");

        var holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId,
            tableId = table2.Id,
            date = bookingDate
        });
        var holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        var createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId,
            tableId = table2.Id,
            date = bookingDate,
            customerEmail = "real@test.com",
            seats = 2,
            holdId
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingRef = created.GetProperty("bookingRef").GetString();

        var response = await client.GetAsync($"/api/bookings/ref/{bookingRef}?email=wrong@test.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRecent_ReturnsEmptyByDefault()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/bookings/my-recent");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task DeleteBooking_RequiresAuth()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/api/bookings/1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteBooking_WithAuth_ReturnsNoContent()
    {
        var client = _factory.CreateAuthenticatedClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var bookingDate = DateTime.UtcNow.AddDays(50).ToString("O");

        // Place hold + create booking
        var unauthClient = _factory.CreateClient();
        var holdResp = await unauthClient.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        var holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        var createResp = await unauthClient.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "delete@test.com",
            seats = 2,
            holdId
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var bookingId = created.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync($"/api/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
