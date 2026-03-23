using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class HoldsControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public HoldsControllerTests(TestWebAppFactory factory)
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
    public async Task PlaceHold_ReturnsHoldId()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        var response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(100).ToString("O")
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("holdId").GetString()));
        Assert.True(body.GetProperty("expiresAt").GetDateTime() > DateTime.UtcNow);
    }

    [Fact]
    public async Task PlaceHold_OnAlreadyHeldTable_ReturnsConflict()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var date = DateTime.UtcNow.AddDays(101).ToString("O");

        // Place first hold
        var first = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Place second hold on same table+date
        var second = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date
        });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_Succeeds()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();

        var holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(102).ToString("O")
        });
        var holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        var response = await client.DeleteAsync($"/api/holds/{holdId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_ThenPlaceAgain_Succeeds()
    {
        var client = _factory.CreateClient();
        var (restaurantId, sectionId, tableId) = GetSeededIds();
        var date = DateTime.UtcNow.AddDays(103).ToString("O");

        // Place hold
        var holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date
        });
        var holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        var holdId = holdBody.GetProperty("holdId").GetString();

        // Release it
        await client.DeleteAsync($"/api/holds/{holdId}");

        // Place again on same table+date
        var secondResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date
        });

        Assert.Equal(HttpStatusCode.OK, secondResp.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_NonExistent_ReturnsNoContent()
    {
        var client = _factory.CreateClient();

        // Releasing a non-existent hold should still return 204 (safe to call)
        var response = await client.DeleteAsync("/api/holds/nonexistent-hold-id");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
