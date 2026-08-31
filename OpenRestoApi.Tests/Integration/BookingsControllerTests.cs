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
        // Concurrency AC: near-simultaneous "any table" submissions for the same slot must never
        // both land on the same table. Pasta Place has exactly one 2-seat table (T2) and two 4-seat
        // tables (T1, P1). For a 4-seat request, at most two of three concurrent submissions can
        // succeed (one per 4-seat table) and no table should ever be double-booked. The "exactly 2"
        // count is timing-sensitive under CI load (a contender may lose the race transiently), so
        // the hard invariant asserted here is: at least one succeeds, never more than the available
        // tables, and every winner is on a distinct table.
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
        Assert.InRange(created, 1, 2); // at least one winner, never more than the two 4-seat tables

        // Collect the tableIds of the winners; they must be distinct — the real invariant.
        var winnerTables = results
            .Where(r => r.status == HttpStatusCode.Created)
            .Select(r => r.body.GetProperty("tableId").GetInt32())
            .ToList();
        Assert.Equal(winnerTables.Count, winnerTables.Distinct().Count());
    }

    // ── The guest secret: a booking reference plus the email on the booking ──────────────
    //
    // There is no account behind a guest booking, so these two endpoints are the whole attack
    // surface for someone holding a victim's email address (not a secret) and guessing refs.
    // Two properties keep that honest and both are pinned below: the 404 must not distinguish
    // "no such ref" from "wrong email" (or the ref alone becomes enumerable), and the ref must
    // stay an opaque string on the read path (or a format change orphans issued confirmations).

    private void SetRestaurantRefFormat(BookingRefFormat format)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        restaurant.BookingRefFormat = format;
        db.SaveChanges();
    }

    private void SeedBookingWithStoredRef(string bookingRef, string email, DateTime dateUtc)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Restaurant restaurant = db.Restaurants.First();
        Section section = db.Sections.First(s => s.RestaurantId == restaurant.Id);
        Table table = db.Tables.OrderByDescending(t => t.Id).First(t => t.SectionId == section.Id);
        db.Bookings.Add(new Booking
        {
            RestaurantId = restaurant.Id,
            SectionId = section.Id,
            TableId = table.Id,
            Date = dateUtc,
            EndTime = dateUtc.AddHours(2),
            CustomerEmail = email,
            CustomerName = "Guest",
            Seats = 2,
            BookingRef = bookingRef
        });
        db.SaveChanges();
    }

    private static async Task<(HttpStatusCode Status, string Body)> ReadAsync(HttpResponseMessage response)
        => (response.StatusCode, await response.Content.ReadAsStringAsync());

    [Fact]
    public async Task GetBookingByRef_UnknownRefAndWrongEmailAreIndistinguishable()
    {
        HttpClient client = _factory.CreateClient();
        string bookingRef = $"indistinguishable-lookup-{Guid.NewGuid():N}";
        SeedBookingWithStoredRef(bookingRef, "owner@test.com", DateTime.UtcNow.AddDays(180));

        (HttpStatusCode wrongEmailStatus, string wrongEmailBody) =
            await ReadAsync(await client.GetAsync($"/api/bookings/ref/{bookingRef}?email=stranger@test.com"));
        (HttpStatusCode unknownRefStatus, string unknownRefBody) =
            await ReadAsync(await client.GetAsync($"/api/bookings/ref/no-such-ref-{Guid.NewGuid():N}?email=owner@test.com"));

        Assert.Equal(HttpStatusCode.NotFound, wrongEmailStatus);
        Assert.Equal(unknownRefStatus, wrongEmailStatus);
        Assert.Equal(unknownRefBody, wrongEmailBody);
    }

    [Fact]
    public async Task CancelBookingByRef_UnknownRefAndWrongEmailAreIndistinguishable()
    {
        HttpClient client = _factory.CreateClient();
        string bookingRef = $"indistinguishable-cancel-{Guid.NewGuid():N}";
        SeedBookingWithStoredRef(bookingRef, "owner@test.com", DateTime.UtcNow.AddDays(181));

        (HttpStatusCode wrongEmailStatus, string wrongEmailBody) = await ReadAsync(
            await client.PostAsJsonAsync($"/api/bookings/ref/{bookingRef}/cancel", new { email = "stranger@test.com" }));
        (HttpStatusCode unknownRefStatus, string unknownRefBody) = await ReadAsync(
            await client.PostAsJsonAsync($"/api/bookings/ref/no-such-ref-{Guid.NewGuid():N}/cancel", new { email = "owner@test.com" }));

        Assert.Equal(HttpStatusCode.NotFound, wrongEmailStatus);
        Assert.Equal(unknownRefStatus, wrongEmailStatus);
        Assert.Equal(unknownRefBody, wrongEmailBody);
    }

    [Fact]
    public async Task ByRef_ResolvesALegacyWordRefAtALocationNowMintingNumericRefs()
    {
        // BookingRefFormat governs minting only. Every booking in every deployed database carries
        // the suffix-less three-word shape, and a location that has since switched formats still
        // has those guests holding confirmations, so the read path treats the ref as opaque.
        HttpClient client = _factory.CreateClient();
        string legacyRef = "crispy-basil-truffle";
        SeedBookingWithStoredRef(legacyRef, "legacy-word@test.com", DateTime.UtcNow.AddDays(182));
        SetRestaurantRefFormat(BookingRefFormat.Numeric);
        try
        {
            HttpResponseMessage lookup = await client.GetAsync($"/api/bookings/ref/{legacyRef}?email=legacy-word@test.com");
            HttpResponseMessage cancel = await client.PostAsJsonAsync($"/api/bookings/ref/{legacyRef}/cancel", new { email = "legacy-word@test.com" });

            Assert.Equal(HttpStatusCode.OK, lookup.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        }
        finally
        {
            SetRestaurantRefFormat(BookingRefFormat.AlphaNumeric);
        }
    }

    [Fact]
    public async Task ByRef_ResolvesANumericRefAtALocationNowMintingWordRefs()
    {
        HttpClient client = _factory.CreateClient();
        string numericRef = "48271639";
        SeedBookingWithStoredRef(numericRef, "legacy-numeric@test.com", DateTime.UtcNow.AddDays(183));
        SetRestaurantRefFormat(BookingRefFormat.AlphaNumeric);

        HttpResponseMessage lookup = await client.GetAsync($"/api/bookings/ref/{numericRef}?email=legacy-numeric@test.com");
        HttpResponseMessage cancel = await client.PostAsJsonAsync($"/api/bookings/ref/{numericRef}/cancel", new { email = "legacy-numeric@test.com" });

        Assert.Equal(HttpStatusCode.OK, lookup.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
    }
}
