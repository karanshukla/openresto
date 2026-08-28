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
/// The Owner-only key-management API: CRUD behaviour and the authorization boundary that keeps
/// a Manager out of it, same shape as <see cref="UsersControllerTests"/>.
/// </summary>
public class ApiKeysControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private HttpClient OwnerClient() => _factory.CreateAuthenticatedClient();

    private async Task<HttpClient> ManagerClientAsync(string email)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential? existing = await db.AdminCredentials.FirstOrDefaultAsync(c => c.Email == email);
        if (existing is null)
        {
            var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
            (string hash, string salt) = passwords.Hash("seeded-password");
            existing = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt, Role = UserRoles.Manager };
            db.AdminCredentials.Add(existing);
            await db.SaveChangesAsync();
        }
        return _factory.CreateClientWithToken(TestWebAppFactory.GenerateJwt(existing.Id, existing.Email, existing.Role));
    }

    private static object ValidCreateBody(string name = "CI bot") => new
    {
        name,
        scopes = new[] { new { resource = "bookings", access = "read" } },
    };

    [Fact]
    public async Task Create_AsOwner_Returns201WithASecretExactlyOnce()
    {
        HttpClient client = OwnerClient();

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody("First key"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.StartsWith("orst_", body.GetProperty("secret").GetString());
        Assert.Equal("First key", body.GetProperty("name").GetString());
        Assert.False(body.TryGetProperty("keyHash", out _));
        Assert.False(body.TryGetProperty("KeyHash", out _));
    }

    [Fact]
    public async Task List_NeverIncludesTheSecretOrTheHash()
    {
        HttpClient client = OwnerClient();
        await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody("Listed key"));

        HttpResponseMessage response = await client.GetAsync("/api/admin/api-keys");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        string raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("secret", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("keyHash", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Create_RejectsAnEmptyName()
    {
        HttpClient client = OwnerClient();

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/admin/api-keys", new { name = "", scopes = new[] { new { resource = "bookings", access = "read" } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_RejectsAnInvalidScopePair()
    {
        HttpClient client = OwnerClient();

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/admin/api-keys", new { name = "bad", scopes = new[] { new { resource = "audit", access = "write" } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Revoke_MakesTheKeyStopWorking()
    {
        HttpClient client = OwnerClient();
        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody("To revoke"));
        JsonElement created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        int id = created.GetProperty("id").GetInt32();
        string secret = created.GetProperty("secret").GetString()!;

        HttpResponseMessage revokeResponse = await client.PostAsync($"/api/admin/api-keys/{id}/revoke", null);
        Assert.Equal(HttpStatusCode.OK, revokeResponse.StatusCode);

        using HttpClient anonymous = _factory.CreateClient();
        anonymous.DefaultRequestHeaders.Add("X-API-Key", secret);
        HttpResponseMessage probe = await anonymous.GetAsync("/api/admin/overview");
        Assert.Equal(HttpStatusCode.Unauthorized, probe.StatusCode);
    }

    [Fact]
    public async Task Revoke_IsIdempotent()
    {
        HttpClient client = OwnerClient();
        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody("Revoke twice"));
        int id = (await createResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/admin/api-keys/{id}/revoke", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/admin/api-keys/{id}/revoke", null)).StatusCode);
    }

    [Fact]
    public async Task List_AsManager_Returns403()
    {
        HttpClient client = await ManagerClientAsync("apikeys-manager@test.com");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/api-keys")).StatusCode);
    }

    [Fact]
    public async Task Create_AsManager_Returns403()
    {
        HttpClient client = await ManagerClientAsync("apikeys-manager-create@test.com");

        HttpResponseMessage response = await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Revoke_AsManager_Returns403()
    {
        HttpClient owner = OwnerClient();
        HttpResponseMessage createResponse = await owner.PostAsJsonAsync(
            "/api/admin/api-keys", ValidCreateBody("Owner's key"));
        int id = (await createResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        HttpClient manager = await ManagerClientAsync("apikeys-manager-revoke@test.com");
        HttpResponseMessage response = await manager.PostAsync($"/api/admin/api-keys/{id}/revoke", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── self (issue #319 Phase 2) ───────────────────────────────────────────

    [Fact]
    public async Task Self_AsJwtSession_Returns400()
    {
        HttpClient client = OwnerClient();

        HttpResponseMessage response = await client.GetAsync("/api/admin/api-keys/self");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ErrorCodes.ApiKeyNotASession, body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Self_AsApiKey_ReturnsTheKeysOwnMetadataAndItsOwner()
    {
        HttpClient ownerClient = OwnerClient();
        HttpResponseMessage createResponse = await ownerClient.PostAsJsonAsync(
            "/api/admin/api-keys", ValidCreateBody("Self-probe"));
        JsonElement created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        string secret = created.GetProperty("secret").GetString()!;
        int id = created.GetProperty("id").GetInt32();

        using HttpClient client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-API-Key", secret);
        HttpResponseMessage response = await client.GetAsync("/api/admin/api-keys/self");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(id, body.GetProperty("id").GetInt32());
        Assert.Equal("Self-probe", body.GetProperty("name").GetString());
        Assert.False(body.TryGetProperty("secret", out _));
        Assert.False(body.TryGetProperty("keyHash", out _));
    }

    [Fact]
    public async Task Self_AsApiKey_WorksRegardlessOfTheKeysOwnScopes()
    {
        // The point of AllowAnyApiKey: a key minted with no relevant scope at all can still
        // introspect itself, unlike every other action on this controller.
        HttpClient ownerClient = OwnerClient();
        HttpResponseMessage createResponse = await ownerClient.PostAsJsonAsync("/api/admin/api-keys", new
        {
            name = "Narrowly scoped",
            scopes = new[] { new { resource = "brand", access = "read" } },
        });
        JsonElement created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        string secret = created.GetProperty("secret").GetString()!;

        using HttpClient client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-API-Key", secret);
        HttpResponseMessage response = await client.GetAsync("/api/admin/api-keys/self");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Self_IsAllowedForAKeyWhoseUnderlyingAccountIsAManager()
    {
        // Self carries its own [Authorize(RequireAdmin)] rather than the RequireOwner every
        // management action on this controller carries individually — a Manager's key can
        // introspect itself even though it could never call GetAll/Create/Revoke.
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
        (string hash, string salt) = passwords.Hash("seeded-password");
        var user = new AdminCredential { Email = "apikeys-self-manager@test.com", PasswordHash = hash, PasswordSalt = salt, Role = UserRoles.Owner };
        db.AdminCredentials.Add(user);
        await db.SaveChangesAsync();
        HttpClient client = _factory.CreateClientWithToken(TestWebAppFactory.GenerateJwt(user.Id, user.Email, user.Role));
        HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/admin/api-keys", ValidCreateBody("Later demoted"));
        JsonElement created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        string secret = created.GetProperty("secret").GetString()!;

        user.Role = UserRoles.Manager;
        await db.SaveChangesAsync();

        using HttpClient keyClient = _factory.CreateClient();
        keyClient.DefaultRequestHeaders.Add("X-API-Key", secret);
        HttpResponseMessage response = await keyClient.GetAsync("/api/admin/api-keys/self");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(UserRoles.Manager, body.GetProperty("role").GetString());
    }
}
