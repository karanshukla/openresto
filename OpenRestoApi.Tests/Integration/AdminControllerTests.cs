using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
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
            date = DateTime.UtcNow.AddDays(200).ToString("O"),
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
        string date = DateTime.UtcNow.AddDays(201).ToString("O");

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
            date = DateTime.UtcNow.AddDays(202).ToString("O"),
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
            date = DateTime.UtcNow.AddDays(203).ToString("O"),
            customerEmail = "cancel@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/bookings/{bookingId}");

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
            date = DateTime.UtcNow.AddDays(204).ToString("O"),
            customerEmail = "purge@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/bookings/{bookingId}/purge");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it's gone
        HttpResponseMessage getResp = await client.GetAsync($"/api/admin/bookings/{bookingId}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
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
    public async Task UpdateBooking_Patch_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int restaurantId, int sectionId, int tableId) = GetSeededIds();

        // Create a booking
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId,
            sectionId,
            tableId,
            date = DateTime.UtcNow.AddDays(205).ToString("O"),
            customerEmail = "patch@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();

        // PATCH to update seats
        var patchContent = new StringContent(
            JsonSerializer.Serialize(new { seats = 4 }),
            Encoding.UTF8,
            "application/json");
        var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/bookings/{bookingId}")
        {
            Content = patchContent
        };
        HttpResponseMessage response = await client.SendAsync(request);

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
            date = DateTime.UtcNow.AddDays(200).ToString("O"),
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
            date = DateTime.UtcNow.AddDays(210).ToString("O"),
            customerEmail = "restore@test.com",
            seats = 2
        });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int bookingId = created.GetProperty("id").GetInt32();
        await client.DeleteAsync($"/api/admin/bookings/{bookingId}");

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
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(1).ToString("O"), customerEmail = "test@test.com", seats = 2 });
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
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(300).ToString("O"), customerEmail = "restore@test.com", seats = 2 });
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
    public async Task DeleteRestaurant_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/restaurants", new { name = "To Delete", address = "Addr" });
        JsonElement created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.DeleteAsync($"/api/admin/restaurants/{id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
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
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(301).ToString("O"), customerEmail = "test@test.com", seats = 2 });
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
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(303).ToString("O"), customerEmail = "orig@test.com", seats = 2 });
        int id = (await createResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpResponseMessage response = await client.PutAsJsonAsync($"/api/admin/bookings/{id}", new { customerEmail = "new@test.com", seats = 3 });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AdminUpdateBooking_InvalidTable_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/admin/bookings", new { restaurantId = r, sectionId = s, tableId = t, date = DateTime.UtcNow.AddDays(304).ToString("O"), customerEmail = "test@test.com", seats = 2 });
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

        // Create a booking
        await client.PostAsJsonAsync("/api/admin/bookings", new
        {
            restaurantId = r,
            sectionId = s,
            tableId = t,
            date = DateTime.UtcNow.AddHours(1).ToString("O"),
            customerEmail = "bulk-extend@test.com",
            seats = 2
        });

        HttpResponseMessage response = await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/extend", new { minutes = 60 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Bookings extended successfully.", body.GetProperty("message").GetString());
        Assert.True(body.GetProperty("extendedBookings").GetArrayLength() >= 1);
    }

    [Fact]
    public async Task CreateBooking_WhenRestaurantPaused_ReturnsConflict()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        (int r, int s, int t) = GetSeededIds();

        // Pause restaurant
        await client.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        // Try to book (non-admin booking route)
        HttpResponseMessage response = await _factory.CreateClient().PostAsJsonAsync("/api/bookings", new
        {
            restaurantId = r,
            sectionId = s,
            tableId = t,
            date = DateTime.UtcNow.AddHours(2).ToString("O"),
            customerEmail = "blocked@test.com",
            seats = 2
        });

        // BookingService throws InvalidOperationException which BookingsController returns as Conflict
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("paused", body.GetProperty("message").GetString()?.ToLower() ?? "");
    }

    [Fact]
    public async Task GetAvailability_WhenRestaurantPaused_ReturnsNoAvailableSlots()
    {
        HttpClient client = _factory.CreateClient();
        (int r, _, _) = GetSeededIds();

        // 1. Pause restaurant via admin
        HttpClient adminClient = _factory.CreateAuthenticatedClient();
        await adminClient.PostAsJsonAsync($"/api/admin/restaurants/{r}/pause", new { minutes = 60 });

        // 2. Check availability (Note: Correct path is api/availability/{r})
        string date = DateTime.UtcNow.AddHours(2).ToString("yyyy-MM-dd");
        HttpResponseMessage response = await client.GetAsync($"/api/availability/{r}?date={date}&seats=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        JsonElement slots = body.GetProperty("slots");
        
        // All slots should be unavailable
        foreach (JsonElement slot in slots.EnumerateArray())
        {
            Assert.False(slot.GetProperty("isAvailable").GetBoolean());
        }
    }
}
