using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace OpenRestoApi.Tests.Integration;

public class AuthControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;
    private readonly JsonSerializerOptions _jsonOpts = new() { PropertyNameCaseInsensitive = true };

    public AuthControllerTests(TestWebAppFactory factory)
    {
        _factory = factory;
    }

    // ── Login ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_WithValidCredentials_Returns200AndToken()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = TestWebAppFactory.AdminPassword
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));
    }

    [Fact]
    public async Task Login_WithWrongEmail_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "wrong@test.com",
            password = TestWebAppFactory.AdminPassword
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
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
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TestWebAppFactory.AdminEmail, body.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Me_WithoutJwt_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── ChangePassword ───────────────────────────────────────────────────────

    [Fact]
    public async Task ChangePassword_WithCorrectCurrent_Succeeds()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newPassword = "NewPass123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verify we can login with the new password
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = "NewPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Reset password back for other tests
        await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "NewPass123!",
            newPassword = TestWebAppFactory.AdminPassword
        });
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrent_Returns401()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "WrongCurrent",
            newPassword = "NewPass123!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithShortNewPassword_Returns400()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/auth/change-password", new
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
        var client = _factory.CreateAuthenticatedClient();

        // 1. Setup PVQ
        var setupResponse = await client.PostAsJsonAsync("/api/auth/pvq/setup", new
        {
            question = "What is your pet's name?",
            answer = "Fluffy"
        });
        Assert.Equal(HttpStatusCode.OK, setupResponse.StatusCode);

        // 2. Check PVQ status
        var statusResponse = await client.GetAsync("/api/auth/pvq");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var status = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(status.GetProperty("isConfigured").GetBoolean());
        Assert.Equal("What is your pet's name?", status.GetProperty("question").GetString());

        // 3. Verify PVQ (unauthenticated)
        var unauthClient = _factory.CreateClient();
        var verifyResponse = await unauthClient.PostAsJsonAsync("/api/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Fluffy"
        });
        Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);
        var verifyBody = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        var resetToken = verifyBody.GetProperty("resetToken").GetString();
        Assert.False(string.IsNullOrEmpty(resetToken));

        // 4. Reset password using the token
        var resetResponse = await unauthClient.PostAsJsonAsync("/api/auth/reset-password", new
        {
            resetToken,
            newPassword = "ResetPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);

        // 5. Login with new password
        var loginResponse = await unauthClient.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = "ResetPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Reset password back for other tests
        await client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "ResetPass123!",
            newPassword = TestWebAppFactory.AdminPassword
        });
    }

    [Fact]
    public async Task PvqVerify_WithWrongAnswer_Returns401()
    {
        var client = _factory.CreateAuthenticatedClient();

        // Ensure PVQ is set up
        await client.PostAsJsonAsync("/api/auth/pvq/setup", new
        {
            question = "What color?",
            answer = "Blue"
        });

        var unauthClient = _factory.CreateClient();
        var response = await unauthClient.PostAsJsonAsync("/api/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Red"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PvqSetup_WithEmptyFields_Returns400()
    {
        var client = _factory.CreateAuthenticatedClient();

        var response = await client.PostAsJsonAsync("/api/auth/pvq/setup", new
        {
            question = "",
            answer = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_Returns400()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/reset-password", new
        {
            resetToken = "invalid-token-that-does-not-exist",
            newPassword = "SomeNewPass123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithShortPassword_Returns400()
    {
        var client = _factory.CreateAuthenticatedClient();

        // Setup and verify PVQ to get a valid token
        await client.PostAsJsonAsync("/api/auth/pvq/setup", new
        {
            question = "Fav food?",
            answer = "Pizza"
        });

        var unauthClient = _factory.CreateClient();
        var verifyResponse = await unauthClient.PostAsJsonAsync("/api/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Pizza"
        });
        var verifyBody = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        var resetToken = verifyBody.GetProperty("resetToken").GetString();

        // Try to reset with short password
        var response = await unauthClient.PostAsJsonAsync("/api/auth/reset-password", new
        {
            resetToken,
            newPassword = "ab"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
