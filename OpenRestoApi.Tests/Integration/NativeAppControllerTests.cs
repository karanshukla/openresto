using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// The native-app status endpoint through the real pipeline: that it is admin-gated, that it is
/// reachable by a <c>brand:read</c> key and no other, and that the JSON it returns is the shape
/// the admin screen is written against. The well-known probe is faked — the check logic lives in
/// <c>NativeAppStatusServiceTests</c>, and an integration test must not depend on the network.
/// </summary>
public class NativeAppControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private const string StatusPath = "/api/admin/native-app/status";

    private readonly TestWebAppFactory _factory = factory;

    private sealed class OfflineProbe : IWellKnownProbe
    {
        public Task<WellKnownProbeResult> FetchAsync(Uri url, CancellationToken cancellationToken = default)
            => Task.FromResult(WellKnownProbeResult.Unreachable("HttpRequestException"));
    }

    private WebApplicationFactory<Program> Offline()
        => _factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddScoped<IWellKnownProbe, OfflineProbe>()));

    private HttpClient AuthenticatedClient()
    {
        HttpClient client = Offline().CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _factory.GenerateTestJwt());
        return client;
    }

    private async Task<HttpClient> ClientWithKeyAsync(string name, string resource, string access)
    {
        HttpResponseMessage minted = await AuthenticatedClient().PostAsJsonAsync("/api/admin/api-keys", new
        {
            name,
            scopes = new[] { new { resource, access } },
        });
        minted.EnsureSuccessStatusCode();
        JsonElement body = await minted.Content.ReadFromJsonAsync<JsonElement>();

        HttpClient client = Offline().CreateClient();
        client.DefaultRequestHeaders.Add("X-API-Key", body.GetProperty("secret").GetString());
        return client;
    }

    [Fact]
    public async Task Status_WithoutAuth_Returns401()
    {
        HttpResponseMessage response = await Offline().CreateClient().GetAsync(StatusPath);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Status_WithAdminJwt_ReturnsTheFiveChecks()
    {
        HttpResponseMessage response = await AuthenticatedClient().GetAsync(StatusPath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(
            [
                NativeAppChecks.Https,
                NativeAppChecks.BrandIcon,
                NativeAppChecks.PrivacyPolicy,
                NativeAppChecks.AppleAppSiteAssociation,
                NativeAppChecks.AndroidAssetLinks,
            ],
            body.GetProperty("checks").EnumerateArray().Select(c => c.GetProperty("id").GetString()));
        Assert.All(
            body.GetProperty("checks").EnumerateArray(),
            c => Assert.Contains(
                c.GetProperty("status").GetString(),
                new[] { NativeAppChecks.Pass, NativeAppChecks.Fail, NativeAppChecks.Skip }));
        Assert.True(body.TryGetProperty("serverUrl", out _));
        Assert.True(body.TryGetProperty("minimumAppVersion", out _));
        Assert.Equal(JsonValueKind.Array, body.GetProperty("clients").ValueKind);
    }

    /// <summary>
    /// The admin screen reads these five field names off each client, so they are part of the
    /// contract rather than an implementation detail of the record they come from.
    /// </summary>
    [Fact]
    public async Task Status_ReportsAggregateClientUseInCamelCase()
    {
        using (IServiceScope scope = _factory.Services.CreateScope())
        {
            AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.NativeClientStats.Add(new NativeClientStat
            {
                Platform = "android",
                AppVersion = "1.9.0",
                Day = DateOnly.FromDateTime(DateTime.UtcNow),
                RequestCount = 123,
                LastSeenUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        HttpResponseMessage response = await AuthenticatedClient().GetAsync(StatusPath);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();

        JsonElement client = Assert.Single(body.GetProperty("clients").EnumerateArray());
        Assert.Equal("android", client.GetProperty("platform").GetString());
        Assert.Equal("1.9.0", client.GetProperty("appVersion").GetString());
        Assert.Equal(123, client.GetProperty("requestsLast7Days").GetInt32());
        Assert.Equal(123, client.GetProperty("requestsLast30Days").GetInt32());
        Assert.True(client.TryGetProperty("lastSeenUtc", out JsonElement lastSeen));
        Assert.NotNull(lastSeen.GetString());
    }

    [Fact]
    public async Task Status_WithABookingsOnlyKey_Returns403()
    {
        HttpClient client = await ClientWithKeyAsync("Bookings only", ApiKeyScopes.Bookings, ApiKeyScopes.Read);

        HttpResponseMessage response = await client.GetAsync(StatusPath);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Status_WithABrandReadKey_Returns200()
    {
        HttpClient client = await ClientWithKeyAsync("Brand read", ApiKeyScopes.Brand, ApiKeyScopes.Read);

        HttpResponseMessage response = await client.GetAsync(StatusPath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
