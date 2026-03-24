using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class RestaurantsControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetAll_ReturnsSeededRestaurants()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/restaurants");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement restaurants = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(restaurants.GetArrayLength() >= 1);

        // Check that at least one restaurant has a name
        foreach (JsonElement r in restaurants.EnumerateArray())
        {
            Assert.False(string.IsNullOrEmpty(r.GetProperty("name").GetString()));
        }
    }

    [Fact]
    public async Task GetById_ReturnsRestaurantWithSectionsAndTables()
    {
        HttpClient client = _factory.CreateClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        int restaurantId = db.Restaurants.First().Id;

        HttpResponseMessage response = await client.GetAsync($"/api/restaurants/{restaurantId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("name").GetString()));

        JsonElement sections = body.GetProperty("sections");
        Assert.True(sections.GetArrayLength() >= 1);

        JsonElement tables = sections[0].GetProperty("tables");
        Assert.True(tables.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/restaurants/9999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateRestaurant_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/restaurants", new
        {
            name = "Unauthorized Restaurant",
            sections = new[] { new { name = "S1", tables = Array.Empty<object>() } }
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateRestaurant_WithAuth_Returns201()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/restaurants", new
        {
            name = "New Restaurant",
            address = "456 New St",
            sections = new[]
            {
                new
                {
                    name = "Terrace",
                    tables = new[]
                    {
                        new { name = "X1", seats = 6 }
                    }
                }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("New Restaurant", body.GetProperty("name").GetString());
        Assert.True(body.GetProperty("id").GetInt32() > 0);
    }

    [Fact]
    public async Task AddSection_WithAuth_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        int restaurantId = db.Restaurants.First().Id;

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/restaurants/{restaurantId}/sections", new
        {
            name = "VIP Section"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VIP Section", body.GetProperty("name").GetString());
        Assert.True(body.GetProperty("id").GetInt32() > 0);
    }

    [Fact]
    public async Task AddTable_WithAuth_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables", new
            {
                name = "NewTable",
                seats = 8
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NewTable", body.GetProperty("name").GetString());
        Assert.Equal(8, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task UpdateRestaurant_WithAuth_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        int restaurantId = db.Restaurants.First().Id;

        HttpResponseMessage response = await client.PutAsJsonAsync($"/api/restaurants/{restaurantId}", new
        {
            name = "Updated Restaurant",
            address = "789 Updated St",
            openTime = "10:00",
            closeTime = "23:00"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Restaurant", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task UpdateSection_WithAuth_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}", new
            {
                name = "Updated Section"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Section", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task UpdateTable_WithAuth_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);
        Table table = db.Tables.First(t => t.SectionId == section.Id);

        HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables/{table.Id}", new
            {
                name = "UpdatedT1",
                seats = 6
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("UpdatedT1", body.GetProperty("name").GetString());
        Assert.Equal(6, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task DeleteTable_WithAuth_ReturnsNoContent()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        // First, add a table to delete
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        HttpResponseMessage addResp = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables", new
            {
                name = "ToDelete",
                seats = 2
            });
        JsonElement addedTable = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        int tableId = addedTable.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables/{tableId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteSection_WithAuth_ReturnsNoContent()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();

        // Add a section to delete
        HttpResponseMessage addResp = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections", new
            {
                name = "TempSection"
            });
        JsonElement addedSection = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        int sectionId = addedSection.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{sectionId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
