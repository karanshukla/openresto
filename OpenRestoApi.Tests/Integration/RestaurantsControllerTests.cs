using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class RestaurantsControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public RestaurantsControllerTests(TestWebAppFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAll_ReturnsSeededRestaurants()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/restaurants");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var restaurants = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(restaurants.GetArrayLength() >= 1);

        // Check that at least one restaurant has a name
        foreach (var r in restaurants.EnumerateArray())
        {
            Assert.False(string.IsNullOrEmpty(r.GetProperty("name").GetString()));
        }
    }

    [Fact]
    public async Task GetById_ReturnsRestaurantWithSectionsAndTables()
    {
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurantId = db.Restaurants.First().Id;

        var response = await client.GetAsync($"/api/restaurants/{restaurantId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("name").GetString()));

        var sections = body.GetProperty("sections");
        Assert.True(sections.GetArrayLength() >= 1);

        var tables = sections[0].GetProperty("tables");
        Assert.True(tables.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetById_NonExistent_Returns404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/restaurants/9999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateRestaurant_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/restaurants", new
        {
            name = "Unauthorized Restaurant",
            sections = new[] { new { name = "S1", tables = Array.Empty<object>() } }
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateRestaurant_WithAuth_Returns201()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/restaurants", new
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
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("New Restaurant", body.GetProperty("name").GetString());
        Assert.True(body.GetProperty("id").GetInt32() > 0);
    }

    [Fact]
    public async Task AddSection_WithAuth_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurantId = db.Restaurants.First().Id;

        var response = await client.PostAsJsonAsync($"/api/restaurants/{restaurantId}/sections", new
        {
            name = "VIP Section"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VIP Section", body.GetProperty("name").GetString());
        Assert.True(body.GetProperty("id").GetInt32() > 0);
    }

    [Fact]
    public async Task AddTable_WithAuth_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();
        var section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        var response = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables", new
            {
                name = "NewTable",
                seats = 8
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("NewTable", body.GetProperty("name").GetString());
        Assert.Equal(8, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task UpdateRestaurant_WithAuth_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurantId = db.Restaurants.First().Id;

        var response = await client.PutAsJsonAsync($"/api/restaurants/{restaurantId}", new
        {
            name = "Updated Restaurant",
            address = "789 Updated St",
            openTime = "10:00",
            closeTime = "23:00"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Restaurant", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task UpdateSection_WithAuth_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();
        var section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        var response = await client.PutAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}", new
            {
                name = "Updated Section"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Section", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task UpdateTable_WithAuth_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();
        var section = db.Sections.First(s => s.RestaurantId == restaurant.Id);
        var table = db.Tables.First(t => t.SectionId == section.Id);

        var response = await client.PutAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables/{table.Id}", new
            {
                name = "UpdatedT1",
                seats = 6
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("UpdatedT1", body.GetProperty("name").GetString());
        Assert.Equal(6, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task DeleteTable_WithAuth_ReturnsNoContent()
    {
        var client = _factory.CreateAuthenticatedClient();

        // First, add a table to delete
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();
        var section = db.Sections.First(s => s.RestaurantId == restaurant.Id);

        var addResp = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables", new
            {
                name = "ToDelete",
                seats = 2
            });
        var addedTable = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        var tableId = addedTable.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{section.Id}/tables/{tableId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteSection_WithAuth_ReturnsNoContent()
    {
        var client = _factory.CreateAuthenticatedClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = db.Restaurants.First();

        // Add a section to delete
        var addResp = await client.PostAsJsonAsync(
            $"/api/restaurants/{restaurant.Id}/sections", new
            {
                name = "TempSection"
            });
        var addedSection = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        var sectionId = addedSection.GetProperty("id").GetInt32();

        var response = await client.DeleteAsync(
            $"/api/restaurants/{restaurant.Id}/sections/{sectionId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
