using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// The embed origins round trip, the Owner-only boundary around it, and the public header nginx
/// copies into the widget page's frame-ancestors. Each class fixture has its own database, so
/// the tests that save origins run in order inside one test.
/// </summary>
public class EmbedSettingsControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private const string SettingsPath = "/api/admin/embed-settings";
    private const string FrameAncestorsPath = "/api/embed/frame-ancestors";

    private readonly TestWebAppFactory _factory = factory;

    private async Task<HttpClient> ManagerClientAsync()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        const string email = "embed-manager@test.com";
        AdminCredential? manager = await db.AdminCredentials.FirstOrDefaultAsync(c => c.Email == email);
        if (manager == null)
        {
            (string hash, string salt) = scope.ServiceProvider.GetRequiredService<IPasswordService>().Hash("seeded-password");
            manager = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt, Role = UserRoles.Manager };
            db.AdminCredentials.Add(manager);
            await db.SaveChangesAsync();
        }

        return _factory.CreateClientWithToken(TestWebAppFactory.GenerateJwt(manager.Id, manager.Email, manager.Role));
    }

    private async Task<HttpClient> BrandWriteKeyClientAsync()
    {
        HttpResponseMessage minted = await _factory.CreateAuthenticatedClient().PostAsJsonAsync("/api/admin/api-keys", new
        {
            name = "embed-brand-write",
            scopes = new[] { new { resource = ApiKeyScopes.Brand, access = ApiKeyScopes.Write } },
        });
        minted.EnsureSuccessStatusCode();
        JsonElement body = await minted.Content.ReadFromJsonAsync<JsonElement>();

        HttpClient client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-API-Key", body.GetProperty("secret").GetString());
        return client;
    }

    private async Task<string> FrameAncestorsAsync()
    {
        HttpResponseMessage response = await _factory.CreateClient().GetAsync(FrameAncestorsPath);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        return string.Join(",", response.Headers.GetValues(EmbedController.FrameAncestorsHeader));
    }

    [Fact]
    public async Task Get_WithoutAuth_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync(SettingsPath)).StatusCode);
    }

    [Fact]
    public async Task Get_AsManager_Returns403()
    {
        HttpClient manager = await ManagerClientAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync(SettingsPath)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await manager.PutAsJsonAsync(SettingsPath, new { allowedOrigins = new[] { "https://evil.example" } })).StatusCode);
    }

    [Fact]
    public async Task Update_WithABrandWriteKey_Returns403()
    {
        HttpClient key = await BrandWriteKeyClientAsync();

        HttpResponseMessage response =
            await key.PutAsJsonAsync(SettingsPath, new { allowedOrigins = new[] { "https://evil.example" } });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Update_WithAPath_Returns400WithTheCode()
    {
        HttpResponseMessage response = await _factory.CreateAuthenticatedClient()
            .PutAsJsonAsync(SettingsPath, new { allowedOrigins = new[] { "https://bistro.example/book" } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ErrorCodes.EmbedOriginInvalid, body.GetProperty("code").GetString());
    }

    [Fact]
    public async Task FrameAncestors_FollowsTheSavedOrigins()
    {
        HttpClient owner = _factory.CreateAuthenticatedClient();

        HttpResponseMessage saved = await owner.PutAsJsonAsync(SettingsPath,
            new { allowedOrigins = new[] { "https://Bistro.example/", "http://localhost:4321" } });
        saved.EnsureSuccessStatusCode();
        JsonElement read = await (await owner.GetAsync(SettingsPath)).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(["https://bistro.example", "http://localhost:4321"],
            read.GetProperty("allowedOrigins").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal("https://bistro.example http://localhost:4321", await FrameAncestorsAsync());

        (await owner.PutAsJsonAsync(SettingsPath, new { allowedOrigins = Array.Empty<string>() })).EnsureSuccessStatusCode();

        Assert.Equal("'none'", await FrameAncestorsAsync());
    }
}
