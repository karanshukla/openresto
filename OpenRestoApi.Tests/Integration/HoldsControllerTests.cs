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

        var date = "2027-10-09T12:00:00"; // A Saturday, far enough ahead to avoid collision with relative-date tests

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date
        });

        if (response.StatusCode != HttpStatusCode.OK)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Failed with {response.StatusCode}: {err}");
        }

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
        string date = DateTime.UtcNow.AddDays(101).ToString("yyyy-MM-ddT12:00:00");

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
            date = DateTime.UtcNow.AddDays(102).ToString("yyyy-MM-ddT12:00:00")
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
        string date = DateTime.UtcNow.AddDays(103).ToString("yyyy-MM-ddT12:00:00");

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
    public async Task PlaceHold_WithCurrentHoldId_AtomicallyReplaces()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string date1 = DateTime.UtcNow.AddDays(110).ToString("yyyy-MM-ddT12:00:00");
        string date2 = DateTime.UtcNow.AddDays(111).ToString("yyyy-MM-ddT12:00:00");

        // Place first hold
        HttpResponseMessage first = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date = date1
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        JsonElement firstBody = await first.Content.ReadFromJsonAsync<JsonElement>();
        string? firstHoldId = firstBody.GetProperty("holdId").GetString();

        // Replace it atomically with a new hold on a different date
        HttpResponseMessage second = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId, sectionId, tableId, date = date2, currentHoldId = firstHoldId
        });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        JsonElement secondBody = await second.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(firstHoldId, secondBody.GetProperty("holdId").GetString());
    }

    [Fact]
    public async Task PlaceHold_InvalidModel_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new { restaurantId = "invalid" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Auto-assign ("Any section") ───────────────────────────────────────────

    private (int restaurantId, int t1Id, int t2Id, int p1Id, int t1SectionId, int p1SectionId) GetPastaPlaceTableIds()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant pasta = db.Restaurants.First(r => r.Name == "Pasta Place");
        Table t1 = db.Tables.First(t => t.Name == "T1");
        Table t2 = db.Tables.First(t => t.Name == "T2");
        Table p1 = db.Tables.First(t => t.Name == "P1");
        return (pasta.Id, t1.Id, t2.Id, p1.Id, t1.SectionId, p1.SectionId);
    }

    [Fact]
    public async Task PlaceHold_AutoAssign_ReturnsHoldWithResolvedTable()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int t1Id, int t2Id, int p1Id, _, _) = GetPastaPlaceTableIds();
        // 2 seats → smallest fitting free table is T2 (2 seats).
        var date = DateTime.UtcNow.AddDays(120).ToString("yyyy-MM-ddT12:00:00");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            seats = 2,
            date
            // tableId/sectionId omitted → auto-assign
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("holdId").GetString()));
        Assert.Equal(t2Id, body.GetProperty("tableId").GetInt32()); // resolved to T2
    }

    [Fact]
    public async Task PlaceHold_AutoAssign_Returns400_WhenSeatsMissing()
    {
        HttpClient client = _factory.CreateClient();
        int restaurantId = GetPastaPlaceTableIds().restaurantId;
        var date = DateTime.UtcNow.AddDays(121).ToString("yyyy-MM-ddT12:00:00");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            date
            // no seats, no tableId/sectionId
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PlaceHold_AutoAssign_Returns409_WhenAllEligibleTablesHeld()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int t1Id, int t2Id, int p1Id, int t1SectionId, int p1SectionId) = GetPastaPlaceTableIds();
        string date = DateTime.UtcNow.AddDays(122).ToString("yyyy-MM-ddT12:00:00");

        // Hold all 2-seat-fitting tables (T1, T2, P1 all fit 2 seats) via explicit holds.
        // T1 and T2 share the Indoor section; P1 is in Patio.
        foreach ((int tid, int sid) in new[] { (t1Id, t1SectionId), (t2Id, t1SectionId), (p1Id, p1SectionId) })
        {
            HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
            {
                restaurantId,
                tableId = tid,
                sectionId = sid,
                date
            });
            Assert.Equal(HttpStatusCode.OK, holdResp.StatusCode);
        }

        // Now an auto-assign for 2 seats should find no free candidate.
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            seats = 2,
            date
        });

        Assert.True(response.StatusCode == HttpStatusCode.Conflict,
            $"Expected Conflict but got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
    }

    [Fact]
    public async Task PlaceHold_AutoAssign_Returns409_WhenNoTableFitsPartySize()
    {
        HttpClient client = _factory.CreateClient();
        int restaurantId = GetPastaPlaceTableIds().restaurantId;
        var date = DateTime.UtcNow.AddDays(123).ToString("yyyy-MM-ddT12:00:00");

        // No seeded table fits a party of 100, so BuildCandidatesAsync returns zero
        // candidates before any hold is ever attempted.
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            seats = 100,
            date
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("No tables are available", body.GetProperty("message").GetString());
    }
}
