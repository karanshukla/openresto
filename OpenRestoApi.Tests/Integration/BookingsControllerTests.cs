using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class BookingsControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private (int restaurantId, int sectionId, int tableId) GetSeededIds()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);
        Table table = db.Tables.First(t => t.SectionId == section.Id);
        return (restaurant.Id, section.Id, table.Id);
    }

    [Fact]
    public async Task CreateBooking_Returns201WithBookingRef()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // First place a hold
        HttpResponseMessage holdResponse = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(10).ToString("O")
        });
        JsonElement holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
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
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("bookingRef").GetString()));
    }

    [Fact]
    public async Task CreateBooking_DuplicateTable_ReturnsConflict()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string bookingDate = DateTime.UtcNow.AddDays(20).ToString("O");

        // First place a hold and create booking
        HttpResponseMessage holdResponse = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        JsonElement holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "first@test.com",
            seats = 2,
            holdId
        });

        // Try to book same table on same date
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
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
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string bookingDate = DateTime.UtcNow.AddDays(30).ToString("O");

        // Place hold + create booking
        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "lookup@test.com",
            seats = 3,
            holdId
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        string? bookingRef = created.GetProperty("bookingRef").GetString();

        // Look up by ref
        HttpResponseMessage response = await client.GetAsync($"/api/bookings/ref/{bookingRef}?email=lookup@test.com");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(bookingRef, body.GetProperty("bookingRef").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("tableName").GetString()));
        Assert.False(string.IsNullOrEmpty(body.GetProperty("sectionName").GetString()));
        Assert.True(body.GetProperty("tableSeats").GetInt32() > 0);
    }

    [Fact]
    public async Task GetBookingByRef_WithWrongEmail_Returns404()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Use a different table to avoid conflicts — get second table
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Table table2 = db.Tables.Where(t => t.SectionId == sectionId).Skip(1).First();

        string bookingDate = DateTime.UtcNow.AddDays(31).ToString("O");

        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId,
            tableId = table2.Id,
            date = bookingDate
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId,
            tableId = table2.Id,
            date = bookingDate,
            customerEmail = "real@test.com",
            seats = 2,
            holdId
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        string? bookingRef = created.GetProperty("bookingRef").GetString();

        HttpResponseMessage response = await client.GetAsync($"/api/bookings/ref/{bookingRef}?email=wrong@test.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRecent_ReturnsEmptyByDefault()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/bookings/my-recent");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task DeleteBooking_RequiresAuth()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.DeleteAsync("/api/bookings/1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteBooking_WithAuth_ReturnsNoContent()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string bookingDate = DateTime.UtcNow.AddDays(50).ToString("O");

        // Place hold + create booking
        HttpClient unauthClient = _factory.CreateClient();
        HttpResponseMessage holdResp = await unauthClient.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage createResp = await unauthClient.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId, sectionId, tableId,
            date = bookingDate,
            customerEmail = "delete@test.com",
            seats = 2,
            holdId
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
