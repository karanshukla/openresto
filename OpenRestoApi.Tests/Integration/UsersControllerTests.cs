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

/// <summary>
/// End-to-end coverage of the Owner-only user-management API, including the authorization
/// boundary: a Manager holds a perfectly valid session and must still be refused.
/// </summary>
public class UsersControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private HttpClient OwnerClient() => _factory.CreateAuthenticatedClient();

    private async Task<HttpClient> ManagerClientAsync(string email = "gate-manager@test.com")
    {
        AdminCredential manager = await SeedUserAsync(email, UserRoles.Manager);
        return _factory.CreateClientWithToken(
            TestWebAppFactory.GenerateJwt(manager.Id, manager.Email, manager.Role));
    }

    private async Task<AdminCredential> SeedUserAsync(string email, string role, bool isActive = true)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential? existing = await db.AdminCredentials.FirstOrDefaultAsync(c => c.Email == email);
        if (existing != null)
        {
            return existing;
        }

        var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
        (string hash, string salt) = passwords.Hash("seeded-password");
        var cred = new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = role,
            IsActive = isActive,
        };
        db.AdminCredentials.Add(cred);
        await db.SaveChangesAsync();
        return cred;
    }

    private static object NewUser(string email, string role = UserRoles.Manager) => new
    {
        email,
        password = "temp-password",
        displayName = "Created By Test",
        role,
    };

    // ── Authorization boundary ───────────────────────────────────────────────

    [Fact]
    public async Task List_WithoutAuth_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await _factory.CreateClient().GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task List_AsManager_Returns403()
    {
        HttpClient manager = await ManagerClientAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task Create_AsManager_Returns403()
    {
        HttpClient manager = await ManagerClientAsync("gate-manager-create@test.com");

        HttpResponseMessage response = await manager.PostAsJsonAsync(
            "/api/admin/users", NewUser("should-not-exist@test.com"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task List_WithAPreMultiUserToken_IsTreatedAsOwner()
    {
        // The single admin of a pre-upgrade instance becomes an Owner, so their in-flight
        // token must keep reaching Owner-only endpoints.
        HttpClient legacy = _factory.CreateClientWithToken(TestWebAppFactory.GenerateLegacyJwt());

        Assert.Equal(HttpStatusCode.OK, (await legacy.GetAsync("/api/admin/users")).StatusCode);
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_ThenList_IncludesTheNewUser()
    {
        HttpClient owner = OwnerClient();

        HttpResponseMessage created = await owner.PostAsJsonAsync(
            "/api/admin/users", NewUser("created@test.com"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        JsonElement list = await (await owner.GetAsync("/api/admin/users")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(list.EnumerateArray(), u => u.GetProperty("email").GetString() == "created@test.com");
    }

    [Fact]
    public async Task Create_ThenLogin_WorksWithTheIssuedPassword()
    {
        HttpClient owner = OwnerClient();
        await owner.PostAsJsonAsync("/api/admin/users", NewUser("loginable@test.com"));

        HttpResponseMessage login = await _factory.CreateClient().PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "loginable@test.com",
            password = "temp-password",
        });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task Create_WithADuplicateEmail_Returns400()
    {
        HttpClient owner = OwnerClient();

        HttpResponseMessage response = await owner.PostAsJsonAsync(
            "/api/admin/users", NewUser(TestWebAppFactory.AdminEmail));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("already exists", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Create_WithAnUnknownRole_Returns400()
    {
        HttpClient owner = OwnerClient();

        HttpResponseMessage response = await owner.PostAsJsonAsync(
            "/api/admin/users", NewUser("bad-role@test.com", "Superuser"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRole_PromotesAManagerToOwner()
    {
        HttpClient owner = OwnerClient();
        AdminCredential target = await SeedUserAsync("promote-me@test.com", UserRoles.Manager);

        HttpResponseMessage response = await owner.PatchAsJsonAsync(
            $"/api/admin/users/{target.Id}/role", new { role = UserRoles.Owner });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(UserRoles.Owner, body.GetProperty("role").GetString());
    }

    [Fact]
    public async Task SetActive_DeactivatesAUser_AndThatUserCanNoLongerLogIn()
    {
        HttpClient owner = OwnerClient();
        await owner.PostAsJsonAsync("/api/admin/users", NewUser("to-disable@test.com"));
        AdminCredential target = await SeedUserAsync("to-disable@test.com", UserRoles.Manager);

        HttpResponseMessage response = await owner.PatchAsJsonAsync(
            $"/api/admin/users/{target.Id}/active", new { isActive = false });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        HttpResponseMessage login = await _factory.CreateClient().PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "to-disable@test.com",
            password = "temp-password",
        });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task SetActive_OnAnUnknownUser_Returns404()
    {
        HttpClient owner = OwnerClient();

        HttpResponseMessage response = await owner.PatchAsJsonAsync(
            "/api/admin/users/999999/active", new { isActive = false });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_LetsTheUserLogInWithTheNewPassword()
    {
        HttpClient owner = OwnerClient();
        await owner.PostAsJsonAsync("/api/admin/users", NewUser("needs-reset@test.com"));
        AdminCredential target = await SeedUserAsync("needs-reset@test.com", UserRoles.Manager);

        HttpResponseMessage response = await owner.PostAsJsonAsync(
            $"/api/admin/users/{target.Id}/reset-password", new { newPassword = "owner-issued-pw" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        HttpResponseMessage login = await _factory.CreateClient().PostAsJsonAsync("/api/admin/auth/login", new
        {
            email = "needs-reset@test.com",
            password = "owner-issued-pw",
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task Demoting_YourselfAsTheLastActiveOwner_Returns400()
    {
        HttpClient owner = OwnerClient();
        AdminCredential seeded = _factory.GetSeededAdmin();
        await LeaveSeededAdminAsTheOnlyActiveOwnerAsync(owner, seeded.Id);

        HttpResponseMessage response = await owner.PatchAsJsonAsync(
            $"/api/admin/users/{seeded.Id}/role", new { role = UserRoles.Manager });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("last active Owner", body.GetProperty("message").GetString());
        // And the instance is still administrable.
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task Deactivating_YourOwnAccount_Returns400()
    {
        HttpClient owner = OwnerClient();
        AdminCredential seeded = _factory.GetSeededAdmin();

        HttpResponseMessage response = await owner.PatchAsJsonAsync(
            $"/api/admin/users/{seeded.Id}/active", new { isActive = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("your own account", body.GetProperty("message").GetString());
    }

    // Other tests in this class share one database and may have promoted someone to Owner;
    // demote them so "the last active Owner" genuinely means the seeded admin.
    private static async Task LeaveSeededAdminAsTheOnlyActiveOwnerAsync(HttpClient owner, int seededId)
    {
        JsonElement list = await (await owner.GetAsync("/api/admin/users")).Content.ReadFromJsonAsync<JsonElement>();
        foreach (JsonElement user in list.EnumerateArray())
        {
            int id = user.GetProperty("id").GetInt32();
            if (id != seededId
                && user.GetProperty("isActive").GetBoolean()
                && user.GetProperty("role").GetString() == UserRoles.Owner)
            {
                await owner.PatchAsJsonAsync($"/api/admin/users/{id}/role", new { role = UserRoles.Manager });
            }
        }
    }
}
