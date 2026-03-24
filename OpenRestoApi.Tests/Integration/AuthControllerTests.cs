using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace OpenRestoApi.Tests.Integration;

public class AuthControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;
    private readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    // ── Login ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_WithValidCredentials_Returns200AndToken()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = TestWebAppFactory.AdminPassword
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        string? message = body.GetProperty("message").GetString();
        Assert.Equal("Login successful.", message);
    }

    [Fact]
    public async Task Login_WithWrongEmail_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "wrong@test.com",
            password = TestWebAppFactory.AdminPassword
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = "WrongPassword999"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Me ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Me_WithValidJwt_Returns200WithEmail()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TestWebAppFactory.AdminEmail, body.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Me_WithoutJwt_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── ChangePassword ───────────────────────────────────────────────────────

    [Fact]
    public async Task ChangePassword_WithCorrectCurrent_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-password", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newPassword = "NewPass123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verify we can login with the new password
        HttpResponseMessage loginResponse = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = "NewPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Reset password back for other tests
        await client.PostAsJsonAsync("/api/admin/auth/change-password", new
        {
            currentPassword = "NewPass123!",
            newPassword = TestWebAppFactory.AdminPassword
        });
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrent_Returns401()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-password", new
        {
            currentPassword = "WrongCurrent",
            newPassword = "NewPass123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithShortNewPassword_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-password", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newPassword = "ab"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── PVQ flow ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task PvqFlow_SetupVerifyAndReset_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        // 1. Setup PVQ
        HttpResponseMessage setupResponse = await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "What is your pet's name?",
            answer = "Fluffy"
        });
        Assert.Equal(HttpStatusCode.OK, setupResponse.StatusCode);

        // 2. Check PVQ status
        HttpResponseMessage statusResponse = await client.GetAsync("/api/admin/auth/pvq");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        JsonElement status = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(status.GetProperty("isConfigured").GetBoolean());
        Assert.Equal("What is your pet's name?", status.GetProperty("question").GetString());

        // 3. Verify PVQ (unauthenticated)
        HttpClient unauthClient = _factory.CreateClient();
        HttpResponseMessage verifyResponse = await unauthClient.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Fluffy"
        });
        Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);
        JsonElement verifyBody = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? resetToken = verifyBody.GetProperty("resetToken").GetString();
        Assert.False(string.IsNullOrEmpty(resetToken));

        // 4. Reset password using the token
        HttpResponseMessage resetResponse = await unauthClient.PostAsJsonAsync("/api/admin/auth/reset-password", new
        {
            resetToken,
            newPassword = "ResetPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);

        // 5. Login with new password
        HttpResponseMessage loginResponse = await unauthClient.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = "ResetPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Reset password back for other tests
        await client.PostAsJsonAsync("/api/admin/auth/change-password", new
        {
            currentPassword = "ResetPass123!",
            newPassword = TestWebAppFactory.AdminPassword
        });
    }

    [Fact]
    public async Task PvqVerify_WithWrongAnswer_Returns401()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        // Ensure PVQ is set up
        await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "What color?",
            answer = "Blue"
        });

        HttpClient unauthClient = _factory.CreateClient();
        HttpResponseMessage response = await unauthClient.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Red"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PvqSetup_WithEmptyFields_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "",
            answer = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_Returns400()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/reset-password", new
        {
            resetToken = "invalid-token-that-does-not-exist",
            newPassword = "SomeNewPass123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithShortPassword_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        // Setup and verify PVQ to get a valid token
        await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "Fav food?",
            answer = "Pizza"
        });

        HttpClient unauthClient = _factory.CreateClient();
        HttpResponseMessage verifyResponse = await unauthClient.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Pizza"
        });
        JsonElement verifyBody = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        string? resetToken = verifyBody.GetProperty("resetToken").GetString();

        // Try to reset with short password
        HttpResponseMessage response = await unauthClient.PostAsJsonAsync("/api/admin/auth/reset-password", new
        {
            resetToken,
            newPassword = "ab"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
