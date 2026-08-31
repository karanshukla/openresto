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
/// The admin API key end to end, through the real authentication pipeline (issue #319 Phase 1):
/// the policy scheme forwarding to <c>ApiKeyAuthenticationHandler</c>, its accept/reject rules,
/// <c>NoApiKeyAccessAttribute</c> on <c>ApiKeysController</c>, and the "a key cannot exceed its
/// owner" rule falling out of the existing role policies rather than anything scope-specific.
/// </summary>
public class ApiKeyAuthTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private async Task<AdminCredential> SeedUserAsync(string email, string role)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential? existing = await db.AdminCredentials.FirstOrDefaultAsync(c => c.Email == email);
        if (existing != null) return existing;

        var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
        (string hash, string salt) = passwords.Hash("seeded-password");
        var user = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt, Role = role };
        db.AdminCredentials.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private async Task ChangeRoleAsync(string email, string role)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential user = await db.AdminCredentials.SingleAsync(c => c.Email == email);
        user.Role = role;
        await db.SaveChangesAsync();
    }

    private async Task DeactivateAsync(string email)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential user = await db.AdminCredentials.SingleAsync(c => c.Email == email);
        user.IsActive = false;
        await db.SaveChangesAsync();
    }

    private async Task ExpireKeyAsync(string secret)
    {
        Assert.True(ApiKeyCrypto.TryParseId(secret, out int id));
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminApiKey key = await db.AdminApiKeys.SingleAsync(k => k.Id == id);
        key.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
    }

    private async Task<string> CreateKeyAsync(AdminCredential owner, object body)
    {
        HttpClient client = _factory.CreateClientWithToken(TestWebAppFactory.GenerateJwt(owner.Id, owner.Email, owner.Role));
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/api-keys", body);
        response.EnsureSuccessStatusCode();
        JsonElement json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("secret").GetString()!;
    }

    private HttpClient ClientWithKey(string secret)
    {
        HttpClient client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-API-Key", secret);
        return client;
    }

    private static object BookingsRead(string name) => new
    {
        name,
        scopes = new[] { new { resource = "bookings", access = "read" } },
    };

    [Fact]
    public async Task ValidKey_AuthenticatesAndCanCallARequireAdminEndpoint()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, BookingsRead("Valid"));

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MalformedKey_Returns401()
    {
        HttpResponseMessage response = await ClientWithKey("not-a-real-key").GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnknownButWellFormedKey_Returns401()
    {
        HttpResponseMessage response = await ClientWithKey("orst_999999_dGVzdC1zZWNyZXQ").GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredKey_Returns401()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, BookingsRead("Expiring"));
        await ExpireKeyAsync(secret);

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RevokedKey_Returns401()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        HttpClient ownerClient = _factory.CreateClientWithToken(TestWebAppFactory.GenerateJwt(owner.Id, owner.Email, owner.Role));
        HttpResponseMessage createResponse = await ownerClient.PostAsJsonAsync("/api/admin/api-keys", BookingsRead("Will be revoked"));
        JsonElement created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();
        string secret = created.GetProperty("secret").GetString()!;
        await ownerClient.PostAsync($"/api/admin/api-keys/{id}/revoke", null);

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task InactiveUnderlyingAccount_Returns401()
    {
        AdminCredential user = await SeedUserAsync("apikey-inactive@test.com", UserRoles.Owner);
        string secret = await CreateKeyAsync(user, BookingsRead("Will be deactivated"));
        await DeactivateAsync(user.Email);

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/overview");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ApiKey_CannotAccessApiKeysControllerEvenWithMatchingScopes()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, new
        {
            name = "Self-mint attempt",
            scopes = new[] { new { resource = "users", access = "write" } },
        });

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/api-keys");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RequireOwnerEndpoint_RejectsAKeyWhoseUnderlyingAccountWasDemotedToManager()
    {
        // A key cannot exceed its owner: the scope alone would allow this call, but RequireOwner
        // checks the role resolved live off the user row at auth time, not anything on the key.
        AdminCredential user = await SeedUserAsync("apikey-demoted@test.com", UserRoles.Owner);
        string secret = await CreateKeyAsync(user, new
        {
            name = "Users writer",
            scopes = new[] { new { resource = "users", access = "write" } },
        });
        await ChangeRoleAsync(user.Email, UserRoles.Manager);

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static object EmailRead(string name) => new
    {
        name,
        scopes = new[] { new { resource = "email", access = "read" } },
    };

    /// <summary>
    /// The boundary issue #407 draws: a key may learn whether outgoing mail works, so an
    /// integration can discover its guests are receiving nothing, but the SMTP credentials that
    /// make it work stay out of reach — a key able to rewrite host/username/password would
    /// redirect every outgoing mail to a relay the caller controls.
    /// </summary>
    [Fact]
    public async Task EmailReadKey_ReachesTheStatusEndpoint()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, EmailRead("Mail watcher"));

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/email-settings/status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EmailReadKey_CannotReachTheCredentialSurface()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, EmailRead("Mail watcher"));
        HttpClient client = ClientWithKey(secret);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/email-settings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync(
            "/api/admin/email-settings",
            new { host = "relay.attacker.test", port = 587, username = "u", password = "p", enableSsl = true })).StatusCode);
    }

    [Fact]
    public async Task KeyWithoutEmailScope_CannotReadTheStatusEndpoint()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, BookingsRead("No mail scope"));

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/email-settings/status");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static object UsersWrite(string name) => new
    {
        name,
        scopes = new[]
        {
            new { resource = "users", access = "read" },
            new { resource = "users", access = "write" },
        },
    };

    private static async Task AssertRejectedAsKeyAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ErrorCodes.ApiKeyNotAllowed, body.GetProperty("code").GetString());
    }

    /// <summary>
    /// The escalation boundary on <c>UsersController</c>: a key may read the account list and
    /// shut a compromised account off, but never obtain or move interactive privilege. Creating
    /// an account with a caller-chosen password, resetting one, or changing a role would each
    /// hand the key's holder a login to the admin UI — and from there everything a key is
    /// excluded from, including minting unscoped keys and rewriting the SMTP credentials.
    /// A Manager login is as fatal as an Owner one, since <c>EmailSettingsController</c> is gated
    /// on RequireAdmin, so the rejection is on the action rather than on the role requested.
    /// </summary>
    [Fact]
    public async Task UsersWriteKey_CannotCreateAnAccount()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, UsersWrite("Escalation attempt"));

        HttpResponseMessage response = await ClientWithKey(secret).PostAsJsonAsync("/api/admin/users", new
        {
            email = "escalated@test.com",
            password = "AttackerChosen123!",
            role = UserRoles.Manager,
        });

        await AssertRejectedAsKeyAsync(response);
    }

    [Fact]
    public async Task UsersWriteKey_CannotResetAPassword()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        AdminCredential target = await SeedUserAsync("apikey-reset-target@test.com", UserRoles.Manager);
        string secret = await CreateKeyAsync(owner, UsersWrite("Reset attempt"));

        HttpResponseMessage response = await ClientWithKey(secret).PostAsJsonAsync(
            $"/api/admin/users/{target.Id}/reset-password", new { newPassword = "AttackerChosen123!" });

        await AssertRejectedAsKeyAsync(response);
    }

    [Fact]
    public async Task UsersWriteKey_CannotChangeARole()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        AdminCredential target = await SeedUserAsync("apikey-role-target@test.com", UserRoles.Manager);
        string secret = await CreateKeyAsync(owner, UsersWrite("Promotion attempt"));

        HttpResponseMessage response = await ClientWithKey(secret).PatchAsJsonAsync(
            $"/api/admin/users/{target.Id}/role", new { role = UserRoles.Owner });

        await AssertRejectedAsKeyAsync(response);
    }

    [Fact]
    public async Task UsersWriteKey_CanStillDeactivateAnAccount()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        AdminCredential target = await SeedUserAsync("apikey-deactivate-target@test.com", UserRoles.Manager);
        string secret = await CreateKeyAsync(owner, UsersWrite("Incident response"));

        HttpResponseMessage response = await ClientWithKey(secret).PatchAsJsonAsync(
            $"/api/admin/users/{target.Id}/active", new { isActive = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UsersReadKey_CanStillListAccounts()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, new
        {
            name = "Account inventory",
            scopes = new[] { new { resource = "users", access = "read" } },
        });

        HttpResponseMessage response = await ClientWithKey(secret).GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MutatingRequest_AuthenticatedByApiKey_RecordsAnAuditEntryNamingTheKey()
    {
        AdminCredential owner = _factory.GetSeededAdmin();
        string secret = await CreateKeyAsync(owner, new
        {
            name = "Audit probe",
            scopes = new[] { new { resource = "locations", access = "write" } },
        });

        HttpResponseMessage response = await ClientWithKey(secret).PostAsJsonAsync(
            "/api/admin/restaurants", new { name = "Keyed Bistro", address = "1 Token St" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminAuditEntry entry = await db.AdminAuditEntries
            .Where(e => e.Path == "/api/admin/restaurants" && e.HttpMethod == "POST")
            .OrderByDescending(e => e.Id)
            .FirstAsync();

        Assert.Equal(owner.Id, entry.ActorUserId);
        Assert.Contains("Audit probe", entry.ActorDisplayName ?? string.Empty, StringComparison.Ordinal);
    }
}
