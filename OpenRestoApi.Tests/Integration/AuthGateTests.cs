using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// Exhaustive auth gate tests — every admin/protected endpoint must return 401
/// when called without a valid JWT. If any test here fails, it means an endpoint
/// is accidentally exposed to the public.
/// </summary>
public class AuthGateTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;

    public AuthGateTests(TestWebAppFactory factory)
    {
        // Unauthenticated client — no JWT
        _client = factory.CreateClient();
    }

    private static StringContent Json(object body) =>
        new(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

    // ── AdminController (all endpoints require [Authorize] at class level) ────

    [Fact]
    public async Task Admin_Overview_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/overview")).StatusCode);

    [Fact]
    public async Task Admin_GetBookings_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/bookings?restaurantId=1")).StatusCode);

    [Fact]
    public async Task Admin_GetBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/bookings/1")).StatusCode);

    [Fact]
    public async Task Admin_CreateBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/bookings", Json(new { }))).StatusCode);

    [Fact]
    public async Task Admin_UpdateBooking_Returns401()
    {
        HttpRequestMessage req = new(HttpMethod.Patch, "/api/admin/bookings/1")
        {
            Content = Json(new { seats = 4 })
        };
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(req)).StatusCode);
    }

    [Fact]
    public async Task Admin_ExtendBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/bookings/1/extend", Json(new { minutes = 30 }))).StatusCode);

    [Fact]
    public async Task Admin_SoftDeleteBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/admin/bookings/1")).StatusCode);

    [Fact]
    public async Task Admin_PurgeBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/admin/bookings/1/purge")).StatusCode);

    [Fact]
    public async Task Admin_CreateRestaurant_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/restaurants", Json(new { name = "Test" }))).StatusCode);

    [Fact]
    public async Task Admin_DeleteRestaurant_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/admin/restaurants/1")).StatusCode);

    [Fact]
    public async Task Admin_GetTables_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/restaurants/1/tables")).StatusCode);

    [Fact]
    public async Task Admin_SendEmail_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/bookings/1/email",
                Json(new { subject = "Hi", body = "Test" }))).StatusCode);

    [Fact]
    public async Task Admin_RestoreBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/bookings/1/restore", null)).StatusCode);

    [Fact]
    public async Task Admin_FullUpdateBooking_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PutAsync("/api/admin/bookings/1", Json(new { }))).StatusCode);

    [Fact]
    public async Task Admin_GetRestaurants_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/restaurants")).StatusCode);

    [Fact]
    public async Task Admin_GetSections_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/restaurants/1/sections")).StatusCode);

    // ── AuthController (protected endpoints) ─────────────────────────────────

    [Fact]
    public async Task Auth_Me_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/auth/me")).StatusCode);

    [Fact]
    public async Task Auth_ChangePassword_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/auth/change-password",
                Json(new { currentPassword = "x", newPassword = "y" }))).StatusCode);

    [Fact]
    public async Task Auth_PvqSetup_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/auth/pvq/setup",
                Json(new { question = "q", answer = "a" }))).StatusCode);

    // ── EmailSettingsController ([Authorize] at class level) ─────────────────

    [Fact]
    public async Task EmailSettings_Get_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/admin/email-settings")).StatusCode);

    [Fact]
    public async Task EmailSettings_Save_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/email-settings",
                Json(new { host = "smtp.test.com", port = 587 }))).StatusCode);

    [Fact]
    public async Task EmailSettings_Test_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/admin/email-settings/test", null)).StatusCode);

    // ── BrandController (POST requires [Authorize], GET is public) ───────────

    [Fact]
    public async Task Brand_Save_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/brand",
                Json(new { appName = "Hacked" }))).StatusCode);

    [Fact]
    public async Task Brand_Get_IsPublic()
    {
        HttpResponseMessage res = await _client.GetAsync("/api/brand");
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── RestaurantsController (mutations require [Authorize], reads are public) ──

    [Fact]
    public async Task Restaurants_List_IsPublic()
    {
        HttpResponseMessage res = await _client.GetAsync("/api/restaurants");
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Restaurants_Create_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/restaurants",
                Json(new { name = "Hacked", address = "Evil St" }))).StatusCode);

    [Fact]
    public async Task Restaurants_Update_Returns401()
    {
        HttpResponseMessage res = await _client.PutAsync("/api/restaurants/1",
            Json(new { name = "Hacked" }));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Restaurants_AddSection_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/restaurants/1/sections",
                Json(new { name = "Evil" }))).StatusCode);

    [Fact]
    public async Task Restaurants_UpdateSection_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PutAsync("/api/restaurants/1/sections/1",
                Json(new { name = "Evil" }))).StatusCode);

    [Fact]
    public async Task Restaurants_DeleteSection_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/restaurants/1/sections/1")).StatusCode);

    [Fact]
    public async Task Restaurants_AddTable_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PostAsync("/api/restaurants/1/sections/1/tables",
                Json(new { name = "T1", seats = 4 }))).StatusCode);

    [Fact]
    public async Task Restaurants_UpdateTable_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PutAsync("/api/restaurants/1/sections/1/tables/1",
                Json(new { name = "T1", seats = 4 }))).StatusCode);

    [Fact]
    public async Task Restaurants_DeleteTable_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/restaurants/1/sections/1/tables/1")).StatusCode);

    // ── BookingsController (some endpoints require [Authorize]) ──────────────

    [Fact]
    public async Task Bookings_GetByRestaurant_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/bookings/restaurant/1")).StatusCode);

    [Fact]
    public async Task Bookings_GetById_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/bookings/1")).StatusCode);

    [Fact]
    public async Task Bookings_Update_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.PutAsync("/api/bookings/1",
                Json(new { seats = 4 }))).StatusCode);

    [Fact]
    public async Task Bookings_Delete_Returns401() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _client.DeleteAsync("/api/bookings/1")).StatusCode);

    // ── Public endpoints (should NOT return 401) ─────────────────────────────

    [Fact]
    public async Task Bookings_Create_IsPublic()
    {
        // Should return 400 (bad request) not 401 — the endpoint is public
        HttpResponseMessage res = await _client.PostAsync("/api/bookings", Json(new { }));
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Bookings_GetByRef_IsPublic()
    {
        HttpResponseMessage res = await _client.GetAsync("/api/bookings/ref/nonexistent?email=a@b.com");
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Bookings_MyRecent_IsPublic()
    {
        HttpResponseMessage res = await _client.GetAsync("/api/bookings/my-recent");
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Holds_Create_IsPublic()
    {
        HttpResponseMessage res = await _client.PostAsync("/api/holds", Json(new { }));
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Holds_Release_IsPublic()
    {
        HttpResponseMessage res = await _client.DeleteAsync("/api/holds/nonexistent");
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Auth_Login_IsPublic()
    {
        // Login is public — wrong credentials return 401 with a message body,
        // not a bare 401 from auth middleware. Verify the endpoint is reachable
        // by checking that it returns a JSON body (middleware 401s have no body).
        HttpResponseMessage res = await _client.PostAsync("/api/admin/auth/login",
            Json(new { email = "x@x.com", password = "wrong" }));
        string body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Invalid email or password", body);
    }

    [Fact]
    public async Task Auth_PvqVerify_IsPublic()
    {
        HttpResponseMessage res = await _client.PostAsync("/api/admin/auth/pvq/verify",
            Json(new { email = "x@x.com", answer = "wrong" }));
        Assert.NotEqual(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Admin_Overview_WithCookie_Works()
    {
        // 1. Get a valid cookie by logging in
        var loginResp = await _client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = TestWebAppFactory.AdminPassword
        });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        // 2. Extract cookie
        string? cookie = null;
        if (loginResp.Headers.TryGetValues("Set-Cookie", out var values))
        {
            cookie = values.FirstOrDefault(v => v.StartsWith("openresto_auth="));
        }
        Assert.NotNull(cookie);

        // 3. Call protected endpoint with cookie instead of header
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/overview");
        request.Headers.Add("Cookie", cookie.Split(';')[0]);
        
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
