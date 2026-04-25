using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class HoldsControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
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
    public async Task PlaceHold_ReturnsHoldId()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(100).ToString("O")
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("holdId").GetString()));
        Assert.True(body.GetProperty("expiresAt").GetDateTime() > DateTime.UtcNow);
    }

    [Fact]
    public async Task PlaceHold_OnAlreadyHeldTable_ReturnsConflict()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string date = DateTime.UtcNow.AddDays(101).ToString("O");

        // Place first hold
        HttpResponseMessage first = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Place second hold on same table+date
        HttpResponseMessage second = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date
        });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_Succeeds()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(102).ToString("O")
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage response = await client.DeleteAsync($"/api/holds/{holdId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_ThenPlaceAgain_Succeeds()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string date = DateTime.UtcNow.AddDays(103).ToString("O");

        // Place hold
        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        // Release it
        await client.DeleteAsync($"/api/holds/{holdId}");

        // Place again on same table+date
        HttpResponseMessage secondResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date
        });

        Assert.Equal(HttpStatusCode.OK, secondResp.StatusCode);
    }

    [Fact]
    public async Task ReleaseHold_NonExistent_ReturnsNoContent()
    {
        HttpClient client = _factory.CreateClient();

        // Releasing a non-existent hold should still return 204 (safe to call)
        HttpResponseMessage response = await client.DeleteAsync("/api/holds/nonexistent-hold-id");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task PlaceHold_InvalidModel_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new { restaurantId = "invalid" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
