using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

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

    // ── ChangeEmail ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ChangeEmail_WithCorrectCurrentPassword_Succeeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "new-admin@test.com"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verify we can login with the new email
        HttpResponseMessage loginResponse = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "new-admin@test.com",
            password = TestWebAppFactory.AdminPassword
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Old email should no longer work
        HttpResponseMessage oldLoginResponse = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = TestWebAppFactory.AdminPassword
        });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginResponse.StatusCode);

        // Reset email back for other tests
        await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = TestWebAppFactory.AdminEmail
        });
    }

    [Fact]
    public async Task ChangeEmail_WithWrongCurrentPassword_Returns401()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = "WrongCurrent",
            newEmail = "someone-else@test.com"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_WithInvalidEmailFormat_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "not-an-email"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("missing-domain@")]
    [InlineData("@missing-local.com")]
    [InlineData("missing-tld@domain")]
    [InlineData("spaces in@email.com")]
    [InlineData("double@@at.com")]
    public async Task ChangeEmail_WithVariousMalformedFormats_Returns400(string malformedEmail)
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = malformedEmail
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_WithSameEmailDifferentCase_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = TestWebAppFactory.AdminEmail.ToUpperInvariant()
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_WithIdenticalEmailSameCase_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = TestWebAppFactory.AdminEmail
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_WithWhitespacePaddedEmail_TrimsAndSucceeds()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "  padded-admin@test.com  "
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("padded-admin@test.com", body.GetProperty("email").GetString());

        // Reset email back for other tests
        await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = TestWebAppFactory.AdminEmail
        });
    }

    [Fact]
    public async Task ChangeEmail_WithEmptyNewEmail_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "   "
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "no-auth@test.com"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChangeEmail_Succeeds_SetsCookieAndMeReflectsNewEmail()
    {
        HttpClient client = _factory.CreateClient();

        // 1. Login to obtain a cookie-based session
        HttpResponseMessage loginResp = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = TestWebAppFactory.AdminEmail,
            password = TestWebAppFactory.AdminPassword
        });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
        string? loginCookie = loginResp.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? loginCookies)
            ? loginCookies.FirstOrDefault(v => v.StartsWith("openresto_auth=", StringComparison.OrdinalIgnoreCase))
            : null;
        Assert.NotNull(loginCookie);

        // 2. Change email using the cookie
        var changeRequest = new HttpRequestMessage(HttpMethod.Post, "/api/admin/auth/change-email")
        {
            Content = JsonContent.Create(new
            {
                currentPassword = TestWebAppFactory.AdminPassword,
                newEmail = "cookie-flow@test.com"
            })
        };
        changeRequest.Headers.Add("Cookie", loginCookie!.Split(';')[0]);
        HttpResponseMessage changeResponse = await client.SendAsync(changeRequest);
        Assert.Equal(HttpStatusCode.OK, changeResponse.StatusCode);

        // 3. Extract the freshly re-issued cookie
        string? newCookie = changeResponse.Headers.TryGetValues("Set-Cookie", out IEnumerable<string>? newCookies)
            ? newCookies.FirstOrDefault(v => v.StartsWith("openresto_auth=", StringComparison.OrdinalIgnoreCase))
            : null;
        Assert.NotNull(newCookie);

        // 4. /me reflects the new email using the re-issued cookie
        var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/admin/auth/me");
        meRequest.Headers.Add("Cookie", newCookie!.Split(';')[0]);
        HttpResponseMessage meResponse = await client.SendAsync(meRequest);
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        JsonElement meBody = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("cookie-flow@test.com", meBody.GetProperty("email").GetString());

        // Reset email back for other tests
        var resetRequest = new HttpRequestMessage(HttpMethod.Post, "/api/admin/auth/change-email")
        {
            Content = JsonContent.Create(new
            {
                currentPassword = TestWebAppFactory.AdminPassword,
                newEmail = TestWebAppFactory.AdminEmail
            })
        };
        resetRequest.Headers.Add("Cookie", newCookie!.Split(';')[0]);
        await client.SendAsync(resetRequest);
    }

    [Fact]
    public async Task ChangeEmail_ThenPvqVerify_MustUseNewEmail()
    {
        // Regression test: VerifyPvqAsync looks up the AdminCredential row by matching
        // the supplied email against cred.Email (AuthService.cs), so a PVQ-based
        // password-reset attempt must follow an email change and use the new address.
        HttpClient client = _factory.CreateAuthenticatedClient();

        // 1. Set up the security question on the account.
        HttpResponseMessage setupResponse = await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "What is your favorite color?",
            answer = "Purple"
        });
        Assert.Equal(HttpStatusCode.OK, setupResponse.StatusCode);

        // 2. Change the login email.
        HttpResponseMessage changeResponse = await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = "pvq-after-change@test.com"
        });
        Assert.Equal(HttpStatusCode.OK, changeResponse.StatusCode);

        HttpClient unauthClient = _factory.CreateClient();

        // 3. Verifying with the OLD email must fail — no credential row matches it anymore.
        HttpResponseMessage oldEmailVerify = await unauthClient.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Purple"
        });
        Assert.Equal(HttpStatusCode.BadRequest, oldEmailVerify.StatusCode);

        // 4. Verifying with the NEW email succeeds — the security question follows the account, not the old address.
        HttpResponseMessage newEmailVerify = await unauthClient.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = "pvq-after-change@test.com",
            answer = "Purple"
        });
        Assert.Equal(HttpStatusCode.OK, newEmailVerify.StatusCode);
        JsonElement verifyBody = await newEmailVerify.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(verifyBody.GetProperty("resetToken").GetString()));

        // Reset email back for other tests
        await client.PostAsJsonAsync("/api/admin/auth/change-email", new
        {
            currentPassword = TestWebAppFactory.AdminPassword,
            newEmail = TestWebAppFactory.AdminEmail
        });
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
        HttpResponseMessage statusResponse = await client.GetAsync($"/api/admin/auth/pvq?email={TestWebAppFactory.AdminEmail}");
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
    public async Task Logout_ClearsCookie()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsync("/api/admin/auth/logout", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Logged out.", body.GetProperty("message").GetString());

        // Note: We can't easily verify the cookie is deleted in this test client setup without more complex logic, 
        // but we verify the endpoint responds correctly.
    }

    [Fact]
    public async Task VerifyPvq_NotConfigured_ReturnsBadRequest()
    {
        // Ensure we have a fresh DB or at least clear the PVQ for this account
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<OpenRestoApi.Infrastructure.Persistence.AppDbContext>();
            AdminCredential cred = await db.AdminCredentials.FirstAsync();
            cred.PvqQuestion = null;
            cred.PvqAnswerHash = null;
            cred.PvqAnswerSalt = null;
            await db.SaveChangesAsync();
        }

        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/pvq/verify", new
        {
            email = TestWebAppFactory.AdminEmail,
            answer = "Any"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Security question not configured for this account.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ResetPassword_WithShortPassword_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new { question = "Q", answer = "A" });

        HttpClient unauth = _factory.CreateClient();
        HttpResponseMessage verifyResp = await unauth.PostAsJsonAsync("/api/admin/auth/pvq/verify", new { email = TestWebAppFactory.AdminEmail, answer = "A" });
        var token = (await verifyResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("resetToken").GetString();

        HttpResponseMessage response = await unauth.PostAsJsonAsync("/api/admin/auth/reset-password", new { resetToken = token, newPassword = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_DoesNotInventAnAccount_WhenNoneExist()
    {
        // Creating the first account is the startup bootstrap's job, not login's. The rows are
        // restored afterwards because the whole class shares one in-memory database.
        List<AdminCredential> saved;
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            saved = await db.AdminCredentials.AsNoTracking().ToListAsync();
            db.AdminCredentials.RemoveRange(db.AdminCredentials);
            await db.SaveChangesAsync();
        }

        try
        {
            HttpClient client = _factory.CreateClient();
            HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/auth/login", new
            {
                email = TestWebAppFactory.AdminEmail,
                password = TestWebAppFactory.AdminPassword
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            using IServiceScope check = _factory.Services.CreateScope();
            Assert.Empty(check.ServiceProvider.GetRequiredService<AppDbContext>().AdminCredentials);
        }
        finally
        {
            using IServiceScope scope = _factory.Services.CreateScope();
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AdminCredentials.AddRange(saved);
            await db.SaveChangesAsync();
        }
    }

    // ── Multi-user ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Me_ReturnsIdDisplayNameAndRole()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        JsonElement body = await (await client.GetAsync("/api/admin/auth/me"))
            .Content.ReadFromJsonAsync<JsonElement>();

        AdminCredential admin = _factory.GetSeededAdmin();
        Assert.Equal(admin.Id, body.GetProperty("id").GetInt32());
        Assert.Equal(UserRoles.Owner, body.GetProperty("role").GetString());
        // DisplayName is optional; the property must still be present so clients can rely on it.
        Assert.True(body.TryGetProperty("displayName", out _));
    }

    [Fact]
    public async Task Me_WithATokenNamingNoAccount_Returns401()
    {
        HttpClient client = _factory.CreateClientWithToken(
            TestWebAppFactory.GenerateJwt(999_999, "ghost@test.com", UserRoles.Owner));

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Me_WithAPreMultiUserToken_StillResolvesTheAccount()
    {
        // A 30-day token minted before the upgrade carries no user id and the retired "Admin"
        // role — it must keep working rather than silently signing the operator out.
        HttpClient client = _factory.CreateClientWithToken(TestWebAppFactory.GenerateLegacyJwt());

        HttpResponseMessage response = await client.GetAsync("/api/admin/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TestWebAppFactory.AdminEmail, body.GetProperty("email").GetString());
    }

    [Fact]
    public async Task LoginAsSecondUser_ReturnsThatUsersOwnSession()
    {
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
            (string hash, string salt) = passwords.Hash("SecondPass123!");
            db.AdminCredentials.Add(new AdminCredential
            {
                Email = "second@test.com",
                PasswordHash = hash,
                PasswordSalt = salt,
                DisplayName = "Second User",
                Role = UserRoles.Manager,
            });
            await db.SaveChangesAsync();
        }

        HttpClient client = _factory.CreateClient();
        HttpResponseMessage login = await client.PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "second@test.com",
            password = "SecondPass123!"
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        string cookie = login.Headers.GetValues("Set-Cookie")
            .First(v => v.StartsWith("openresto_auth=", StringComparison.OrdinalIgnoreCase))
            .Split(';')[0];
        var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/admin/auth/me");
        meRequest.Headers.Add("Cookie", cookie);
        JsonElement me = await (await client.SendAsync(meRequest)).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("second@test.com", me.GetProperty("email").GetString());
        Assert.Equal("Second User", me.GetProperty("displayName").GetString());
        Assert.Equal(UserRoles.Manager, me.GetProperty("role").GetString());
    }

    [Fact]
    public async Task PvqStatus_IsKeyedByEmail_AndPvqMe_ReturnsTheCallersOwn()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        await client.PostAsJsonAsync("/api/admin/auth/pvq/setup", new
        {
            question = "Which street?",
            answer = "Baker"
        });

        HttpClient unauth = _factory.CreateClient();
        JsonElement known = await (await unauth.GetAsync(
            $"/api/admin/auth/pvq?email={TestWebAppFactory.AdminEmail}")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Which street?", known.GetProperty("question").GetString());

        JsonElement unknown = await (await unauth.GetAsync(
            "/api/admin/auth/pvq?email=nobody@test.com")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(unknown.GetProperty("isConfigured").GetBoolean());

        JsonElement mine = await (await client.GetAsync("/api/admin/auth/pvq/me"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Which street?", mine.GetProperty("question").GetString());
    }
}
