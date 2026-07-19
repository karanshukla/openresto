using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Cookies;
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
            date = DateTime.UtcNow.AddDays(10).ToString("yyyy-MM-ddT12:00:00")
        });
        JsonElement holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(10).ToString("yyyy-MM-ddT12:00:00"),
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
        string bookingDate = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-ddT12:00:00");

        // First place a hold and create booking
        HttpResponseMessage holdResponse = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = bookingDate
        });
        JsonElement holdBody = await holdResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = bookingDate,
            customerEmail = "first@test.com",
            seats = 2,
            holdId
        });

        // Try to book same table on same date
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
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
        string bookingDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-ddT12:00:00");

        // Place hold + create booking
        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = bookingDate
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
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

        string bookingDate = DateTime.UtcNow.AddDays(31).ToString("yyyy-MM-ddT12:00:00");

        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            sectionId,
            tableId = table2.Id,
            date = bookingDate
        });
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();

        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
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
    public async Task GetBooking_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking first
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(60).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "get@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.GetAsync($"/api/bookings/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(id, body.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task GetBookingByRef_MissingEmail_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/api/bookings/ref/SOME-REF"); // No email query param

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetBooking_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.GetAsync("/api/bookings/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBooking_IdMismatch_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/bookings/1", new { id = 2 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CancelBooking_Succeeds()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(70).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "cancel@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        string? bookingRef = created.GetProperty("bookingRef").GetString();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/bookings/ref/{bookingRef}/cancel", new { email = "cancel@test.com" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CancelBooking_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/bookings/ref/INVALID?email=test@test.com");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CancelBookingByRef_PastBooking_ReturnsConflict_AndLeavesBookingActiveInDb()
    {
        // Customer-facing booking creation rejects past dates, so seed the past booking
        // via the admin route (intentionally exempt per #160) then exercise the real
        // customer cancel endpoint end-to-end (HTTP -> controller -> service -> SQLite).
        HttpClient adminClient = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        HttpResponseMessage createResp = await adminClient.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss"),
            customerEmail = "past-customer-cancel@test.com",
            seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        string? bookingRef = created.GetProperty("bookingRef").GetString();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/bookings/ref/{bookingRef}/cancel",
            new { email = "past-customer-cancel@test.com" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("passed", body.GetProperty("message").GetString()?.ToLower() ?? "");

        // The rejected request must not have flipped IsCancelled in the real database.
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Booking? inDb = await db.Bookings.FindAsync(bookingId);
        Assert.NotNull(inDb);
        Assert.False(inDb!.IsCancelled);
    }

    [Fact]
    public async Task CancelBookingByRef_WithinFiveMinuteGracePeriod_Succeeds()
    {
        HttpClient adminClient = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        HttpResponseMessage createResp = await adminClient.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddMinutes(-4).ToString("yyyy-MM-ddTHH:mm:ss"),
            customerEmail = "grace-customer-cancel@test.com",
            seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        string? bookingRef = created.GetProperty("bookingRef").GetString();

        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/bookings/ref/{bookingRef}/cancel",
            new { email = "grace-customer-cancel@test.com" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CreateBooking_InvalidModel_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateClient();
        // Sending something that doesn't match the DTO at all or missing required fields if we had them.
        // For now, sending null body or invalid JSON structure can trigger it.
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new { seats = "not-a-number" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBooking_InvalidModel_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/bookings/1", new { id = 1, seats = "not-a-number" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CancelBookingByRef_MissingEmail_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings/ref/SOME-REF/cancel", new { email = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetBookings_ByRestaurant_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, _, _) = GetSeededIds();
        HttpResponseMessage response = await client.GetAsync($"/api/restaurants/{r}/bookings");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task DeleteBooking_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(90).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "del@test.com", seats = 2 });
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/bookings/{id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRecent_WithCookie_ReturnsList()
    {
        HttpClient client = _factory.CreateClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(80).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "recent@test.com", seats = 2 });

        // Extract the cookie from the response
        if (createResp.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? cookies))
        {
            foreach (var cookie in cookies)
            {
                client.DefaultRequestHeaders.Add("Cookie", cookie.Split(';')[0]);
            }
        }

        HttpResponseMessage response = await client.GetAsync("/api/bookings/my-recent");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        List<CachedBookingEntry>? body = await response.Content.ReadFromJsonAsync<List<CachedBookingEntry>>();
        Assert.NotEmpty(body!);
        Assert.Contains(body!, e => e.Email == "recent@test.com");
    }

    // ── Auto-assign ("Any section") ───────────────────────────────────────────

    private (int restaurantId, int t2Id, int t2SectionId) GetPastaPlaceIds()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant pasta = db.Restaurants.First(r => r.Name == "Pasta Place");
        Table t2 = db.Tables.First(t => t.Name == "T2");
        return (pasta.Id, t2.Id, t2.SectionId);
    }

    [Fact]
    public async Task CreateBooking_AutoAssign_PersistsResolvedTable()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int t2Id, int t2SectionId) = GetPastaPlaceIds();
        string date = DateTime.UtcNow.AddDays(90).ToString("yyyy-MM-ddT12:00:00");

        // No tableId/sectionId/holdId → server must auto-assign. For 2 seats the smallest
        // fitting free table across Pasta Place is T2 (2 seats).
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            date,
            customerEmail = "auto@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("bookingRef").GetString()));
        Assert.Equal(t2Id, body.GetProperty("tableId").GetInt32());
        Assert.Equal(t2SectionId, body.GetProperty("sectionId").GetInt32());
    }

    [Fact]
    public async Task CreateBooking_AutoAssign_ConsumesAutoHold()
    {
        HttpClient client = _factory.CreateClient();
        (int restaurantId, int t2Id, _) = GetPastaPlaceIds();
        string date = DateTime.UtcNow.AddDays(91).ToString("yyyy-MM-ddT12:00:00");

        // Place an auto-assigned hold first.
        HttpResponseMessage holdResp = await client.PostAsJsonAsync("/api/holds", new
        {
            restaurantId,
            seats = 2,
            date
        });
        Assert.Equal(HttpStatusCode.OK, holdResp.StatusCode);
        JsonElement holdBody = await holdResp.Content.ReadFromJsonAsync<JsonElement>();
        string? holdId = holdBody.GetProperty("holdId").GetString();
        Assert.Equal(t2Id, holdBody.GetProperty("tableId").GetInt32()); // auto-resolved to T2

        // Consume that hold with an auto-assign booking.
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/bookings", new
        {
            restaurantId,
            date,
            customerEmail = "auto2@test.com",
            seats = 2,
            holdId
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(t2Id, body.GetProperty("tableId").GetInt32());
    }

    [Fact]
    public async Task CreateBooking_AutoAssign_NeverDoubleBooksSameTable_WhenContended()
    {
        // Concurrency AC: two near-simultaneous "any table" submissions for the same slot
        // must never both land on the same table. Pasta Place has exactly one 2-seat table
        // (T2) and two 4-seat tables (T1, P1). For a 4-seat request, exactly two of three
        // concurrent submissions should succeed (one per 4-seat table); the third should
        // conflict. No table should be double-booked.
        HttpClient client = _factory.CreateClient();
        (int restaurantId, _, _) = GetPastaPlaceIds();
        string date = DateTime.UtcNow.AddDays(92).ToString("yyyy-MM-ddT12:00:00");

        var tasks = Enumerable.Range(0, 3).Select(i => Task.Run(async () =>
        {
            HttpClient c = _factory.CreateClient();
            HttpResponseMessage r = await c.PostAsJsonAsync("/api/bookings", new
            {
                restaurantId,
                date,
                customerEmail = $"race{i}@test.com",
                seats = 4
            });
            JsonElement body = await r.Content.ReadFromJsonAsync<JsonElement>();
            return new { status = r.StatusCode, body };
        })).ToArray();
        var results = await Task.WhenAll(tasks);

        int created = results.Count(r => r.status == HttpStatusCode.Created);
        Assert.Equal(2, created); // T1 and P1 each take one winner

        // Collect the tableIds of the winners; they must be distinct.
        var winnerTables = results
            .Where(r => r.status == HttpStatusCode.Created)
            .Select(r => r.body.GetProperty("tableId").GetInt32())
            .ToList();
        Assert.Equal(winnerTables.Count, winnerTables.Distinct().Count());
    }
}
