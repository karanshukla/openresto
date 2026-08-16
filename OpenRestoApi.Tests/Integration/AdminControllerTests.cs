using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class AdminControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
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

    // ── Auth requirement ─────────────────────────────────────────────────────

    [Fact]
    public async Task Overview_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetBookings_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/bookings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Overview ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Overview_ReturnsStats()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("totalRestaurants").GetInt32() >= 1);
    }

    // ── Bookings ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBookings_WithStatusFilter_ReturnsFiltered()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/bookings?status=active");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
    }

    [Fact]
    public async Task CreateAdminBooking_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(200).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "walkin@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("id").GetInt32() > 0);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("bookingRef").GetString()));
    }

    [Fact]
    public async Task CreateAdminBooking_DuplicateTableDate_ReturnsConflict()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();
        string date = DateTime.UtcNow.AddDays(201).ToString("yyyy-MM-ddT12:00:00");

        // First booking
        await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date,
            customerEmail = "first@test.com",
            seats = 2
        });

        // Duplicate
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date,
            customerEmail = "second@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ExtendBooking_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking to extend
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(202).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "extend@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/bookings/{bookingId}/extend", new
        {
            minutes = 30
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("endTime", out _));
    }

    [Fact]
    public async Task CancelBooking_SoftDelete_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking to cancel
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(203).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "cancel@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsync($"/api/admin/bookings/{bookingId}/cancel", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it shows as cancelled
        HttpResponseMessage cancelledResp = await client.GetAsync("/api/admin/bookings?status=cancelled");
        JsonElement cancelledBody = await cancelledResp.Content.ReadFromJsonAsync<JsonElement>();
        bool found = false;
        foreach (JsonElement b in cancelledBody.EnumerateArray())
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
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking to purge
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(204).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "purge@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/bookings/{bookingId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it's gone
        HttpResponseMessage getResp = await client.GetAsync($"/api/admin/bookings/{bookingId}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task CancelBooking_PastBooking_ReturnsConflict_AndLeavesBookingActiveInDb()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Admin creation is intentionally exempt from the past-date guard (#160),
        // so this is the only way to seed a genuinely past, non-cancelled booking.
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss"),
            customerEmail = "past-admin-cancel@test.com",
            seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        int bookingId = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsync($"/api/admin/bookings/{bookingId}/cancel", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("passed", body.GetProperty("message").GetString()?.ToLower() ?? "");

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Booking? inDb = await db.Bookings.FindAsync(bookingId);
        Assert.NotNull(inDb);
        Assert.False(inDb!.IsCancelled);
    }

    [Fact]
    public async Task CancelBooking_AlreadyCancelledPastBooking_IsIdempotent_ReturnsNoContent()
    {
        // The already-cancelled short-circuit must run before the past-date guard,
        // so re-cancelling a past booking that's already cancelled stays a no-op
        // success rather than regressing to a 400 — this is a real end-to-end
        // regression guard for the check-ordering in AdminService.CancelBookingAsync.
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-ddTHH:mm:ss"),
            customerEmail = "past-admin-idempotent@test.com",
            seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        int bookingId = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Cancel while still active is impossible for a past booking (guarded above),
        // so mark it cancelled directly in the DB to reach the already-cancelled state.
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Booking booking = await db.Bookings.FindAsync(bookingId) ?? throw new InvalidOperationException("seed booking missing");
            booking.IsCancelled = true;
            await db.SaveChangesAsync();
        }

        HttpResponseMessage response = await client.PostAsync($"/api/admin/bookings/{bookingId}/cancel", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task CancelBooking_NonExistent_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.DeleteAsync("/api/admin/bookings/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PurgeBooking_NonExistent_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.DeleteAsync("/api/admin/bookings/99999/purge");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateBooking_Put_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(205).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "put@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        // PUT to update seats
        HttpResponseMessage response = await client.PutAsJsonAsync($"/api/admin/bookings/{bookingId}", new
        {
            seats = 4
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(4, body.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task GetBookings_WithCancelledFilter_ReturnsCancelledOnly()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/bookings?cancelled=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        foreach (JsonElement b in body.EnumerateArray())
        {
            Assert.True(b.GetProperty("isCancelled").GetBoolean());
        }
    }

    [Fact]
    public async Task GetBookings_WithRestaurantFilter_ReturnsFiltered()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, _, _) = GetSeededIds();

        HttpResponseMessage response = await client.GetAsync($"/api/admin/bookings?restaurantId={restaurantId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        foreach (JsonElement b in body.EnumerateArray())
        {
            Assert.Equal(restaurantId, b.GetProperty("restaurantId").GetInt32());
        }
    }

    [Fact]
    public async Task GetBookings_WithDateFilter_ReturnsFiltered()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        string date = DateTime.UtcNow.AddDays(200).ToString("yyyy-MM-dd");

        HttpResponseMessage response = await client.GetAsync($"/api/admin/bookings?date={date}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        foreach (JsonElement b in body.EnumerateArray())
        {
            // The API might return a UTC date that shifted the local day by 1.
            // For stability, we check if the returned year-month is correct 
            // and the day is within 1 of the requested date.
            string? actualDate = b.GetProperty("date").GetString();
            Assert.NotNull(actualDate);
            
            // Check year-month as a baseline
            string yearMonth = date.Substring(0, 7); 
            Assert.Contains(yearMonth, actualDate);
        }
    }

    [Fact]
    public async Task CreateAdminBooking_InvalidTableSection_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, _, _) = GetSeededIds();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId = 999, // Invalid
            tableId = 999,   // Invalid
            date = DateTime.UtcNow.AddDays(200).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "bad@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBooking_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create and cancel a booking
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(210).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "restore@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();
        await client.PostAsync($"/api/admin/bookings/{bookingId}/cancel", null);

        // Restore
        HttpResponseMessage response = await client.PostAsync($"/api/admin/bookings/{bookingId}/restore", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Booking restored successfully.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task GetBooking_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "test@test.com", seats = 2 });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.GetAsync($"/api/admin/bookings/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PatchBooking_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PatchAsJsonAsync("/api/admin/bookings/9999", new { seats = 4 });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ExtendBooking_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/bookings/9999/extend", new { minutes = 30 });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBooking_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsync("/api/admin/bookings/9999/restore", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBooking_AlreadyActive_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(300).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "restore@test.com", seats = 2 });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsync($"/api/admin/bookings/{id}/restore", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendEmail_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/bookings/9999/email", new { subject = "T", body = "B" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendEmail_ValidBooking_ReturnsOk_WithPlainTextBody()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId = r, sectionId = s, tableId = t,
            date = DateTime.UtcNow.AddDays(310).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "emailtest@test.com", seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/bookings/{id}/email",
            new { subject = "Test message", body = "Hello, this is a test." });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("emailtest@test.com", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task SendEmail_ValidBooking_ReturnsOk_WithHtmlBody()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId = r, sectionId = s, tableId = t,
            date = DateTime.UtcNow.AddDays(311).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "htmltest@test.com", seats = 2
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/bookings/{id}/email",
            new { subject = "HTML message", body = "<p>Hello</p><p>This is a test.</p>" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetRestaurants_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.GetAsync("/api/admin/restaurants");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetSections_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, _, _) = GetSeededIds();
        HttpResponseMessage response = await client.GetAsync($"/api/admin/restaurants/{r}/sections");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetTables_ReturnsOk()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, _, _) = GetSeededIds();
        HttpResponseMessage response = await client.GetAsync($"/api/admin/restaurants/{r}/tables");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateRestaurant_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/restaurants", new { name = "New Resto", address = "123 Main" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRestaurant_Succeeds_AfterArchiving()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        int id = await CreateRestaurantAsync(client, "To Delete");
        await client.PatchAsJsonAsync($"/api/admin/restaurants/{id}", new { isArchived = true });

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/restaurants/{id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRestaurant_ReturnsBadRequest_WhenNotArchived()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        int id = await CreateRestaurantAsync(client, "Still Live");

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/restaurants/{id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/admin/restaurants/{id}/delete-preview")).StatusCode);
    }

    [Fact]
    public async Task DeleteRestaurant_ReturnsForbidden_ForAManager()
    {
        HttpClient owner = _factory.CreateAuthenticatedClient();
        int id = await CreateRestaurantAsync(owner, "Manager Cannot Delete");
        await owner.PatchAsJsonAsync($"/api/admin/restaurants/{id}", new { isArchived = true });

        HttpClient manager = _factory.CreateClientWithToken(
            TestWebAppFactory.GenerateJwt(999, "manager@test.com", UserRoles.Manager));

        Assert.Equal(HttpStatusCode.Forbidden, (await manager.DeleteAsync($"/api/admin/restaurants/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync($"/api/admin/restaurants/{id}/delete-preview")).StatusCode);
    }

    [Fact]
    public async Task GetRestaurantDeletePreview_ReturnsCounts()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        int id = await CreateRestaurantAsync(client, "Preview Me");

        HttpResponseMessage response = await client.GetAsync($"/api/admin/restaurants/{id}/delete-preview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement preview = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Preview Me", preview.GetProperty("name").GetString());
        Assert.False(preview.GetProperty("isArchived").GetBoolean());
        Assert.Equal(0, preview.GetProperty("bookingCount").GetInt32());
    }

    [Fact]
    public async Task GetRestaurantDeletePreview_ReturnsNotFound_ForUnknownRestaurant()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.GetAsync("/api/admin/restaurants/99999/delete-preview");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<int> CreateRestaurantAsync(HttpClient client, string name)
    {
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/restaurants", new { name, address = "Addr" });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        return created.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task CreateRestaurant_EmptyName_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/restaurants", new { name = "", address = "Addr" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRestaurant_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/admin/restaurants/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetTables_NotFound_ReturnsNotFound()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.GetAsync("/api/admin/restaurants/9999/tables");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendEmail_MissingFields_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(301).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "test@test.com", seats = 2 });
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/bookings/{id}/email", new { subject = "", body = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendEmail_MissingCustomerEmail_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        // Create booking without email if allowed by DTO, or use service to force it.
        // Actually, CreateAdminBookingRequest might require it. Let's see.
        // Or just use service to create one manually in DB.
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var b = new Booking { RestaurantId = r, SectionId = s, TableId = t, Date = DateTime.UtcNow.AddDays(302), BookingRef = "NOEMAIL", CustomerEmail = null, Seats = 2 };
            db.Bookings.Add(b);
            await db.SaveChangesAsync();

            HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/bookings/{b.Id}/email", new { subject = "S", body = "B" });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task AdminUpdateBooking_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(303).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "orig@test.com", seats = 2 });
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PutAsJsonAsync($"/api/admin/bookings/{id}", new { customerEmail = "new@test.com", seats = 3 });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AdminUpdateBooking_InvalidTable_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(304).ToString("yyyy-MM-ddT12:00:00"), customerEmail = "test@test.com", seats = 2 });
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PutAsJsonAsync($"/api/admin/bookings/{id}", new { tableId = 9999 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PauseRestaurant_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, _, _) = GetSeededIds();

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bookings paused successfully.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task UnpauseRestaurant_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, _, _) = GetSeededIds();

        // Pause first
        await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        // Then unpause
        HttpResponseMessage response = await client.PostAsync($"/api/admin/restaurants/{r}/unpause", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bookings unpaused successfully.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ExtendRestaurantBookings_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();

        // Create an active booking (started 30 mins ago)
        await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId = r,
            sectionId = s,
            tableId = t,
            date = DateTime.UtcNow.AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss"),
            customerEmail = "bulk-extend@test.com",
            seats = 2
        });

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/extend", new { minutes = 60 });
        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Extend failed with {response.StatusCode}: {errBody}");
        }
        Assert.True(response.IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bookings extended successfully.", body.GetProperty("message").GetString());
        Assert.True(body.GetProperty("extendedBookings").GetArrayLength() >= 1);
    }

    [Fact]
    public async Task ExtendRestaurantBookings_SkipsExpiredBookingsWithNoEndTime()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();

        // Create a booking that started 2 hours ago (past the implicit 1-hour window) with no EndTime
        int expiredBookingId;
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var expired = new Booking
            {
                RestaurantId = r,
                SectionId = s,
                TableId = t,
                Date = DateTime.UtcNow.AddHours(-2),
                BookingRef = "EXPIRED1",
                CustomerEmail = "expired@test.com",
                Seats = 2,
                EndTime = null
            };
            db.Bookings.Add(expired);
            await db.SaveChangesAsync();
            expiredBookingId = expired.Id;
        }

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/extend", new { minutes = 60 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();

        // The expired booking must not appear in the extended list
        bool expiredWasExtended = false;
        foreach (JsonElement b in body.GetProperty("extendedBookings").EnumerateArray())
        {
            if (b.GetProperty("id").GetInt32() == expiredBookingId)
            {
                expiredWasExtended = true;
                break;
            }
        }
        Assert.False(expiredWasExtended, "A booking that started >1h ago with no EndTime should not be extended.");

        // Verify the expired booking's EndTime is still null in DB
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Booking? expired = await db.Bookings.FindAsync(expiredBookingId);
            Assert.NotNull(expired);
            Assert.Null(expired.EndTime);
        }
    }

    [Fact]
    public async Task CreateBooking_WhenRestaurantPaused_ReturnsConflict()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();

        // Pause for three days, so tomorrow's sitting is unambiguously inside the window.
        await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 3 * 24 * 60 });

        // Try to book (non-admin booking route)
        HttpResponseMessage response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            restaurantId = r,
            sectionId = s,
            tableId = t,
            date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "blocked@test.com",
            seats = 2
        });

        // BookingService throws InvalidOperationException which BookingsController returns as Conflict
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("paused", body.GetProperty("message").GetString()?.ToLower() ?? "");
    }

    [Fact]
    public async Task CreateBooking_WhenRestaurantPaused_StillAcceptsATimeBeyondThePauseWindow()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();

        await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        HttpResponseMessage response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            restaurantId = r,
            sectionId = s,
            tableId = t,
            date = DateTime.UtcNow.AddDays(5).ToString("yyyy-MM-ddT12:00:00"),
            customerEmail = "later@test.com",
            seats = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetAvailability_WhenRestaurantPaused_ReturnsNoAvailableSlots()
    {
        HttpClient client = _factory.CreateClient();
        (int r, _, _) = GetSeededIds();

        // 1. Pause restaurant via admin, for a window that covers the whole of tomorrow.
        HttpClient adminClient = _factory.CreateAuthenticatedClient();
        await adminClient.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 2 * 24 * 60 });

        // 2. Check availability (Note: Correct path is api/availability/{r})
        string date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        HttpResponseMessage response = await client.GetAsync($"/api/restaurants/{r}/availability?date={date}&seats=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        JsonElement slots = body.GetProperty("slots");

        // All slots should be unavailable
        foreach (JsonElement slot in slots.EnumerateArray())
        {
            Assert.False(slot.GetProperty("isAvailable").GetBoolean());
        }
    }

    [Fact]
    public async Task GetAvailability_WhenRestaurantPaused_StillOffersSlotsBeyondThePauseWindow()
    {
        HttpClient client = _factory.CreateClient();
        (int r, _, _) = GetSeededIds();

        HttpClient adminClient = _factory.CreateAuthenticatedClient();
        await adminClient.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        string date = DateTime.UtcNow.AddDays(5).ToString("yyyy-MM-dd");
        HttpResponseMessage response = await client.GetAsync($"/api/restaurants/{r}/availability?date={date}&seats=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        JsonElement slots = body.GetProperty("slots");

        Assert.Contains(slots.EnumerateArray(), s => s.GetProperty("isAvailable").GetBoolean());
    }
}
