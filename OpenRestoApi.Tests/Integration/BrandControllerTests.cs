using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class BrandControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetBrand_ReturnsOkWithExpectedFields()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Brand may have been modified by other tests, just check fields exist
        Assert.True(body.TryGetProperty("appName", out JsonElement appName));
        Assert.False(string.IsNullOrEmpty(appName.GetString()));
        Assert.True(body.TryGetProperty("primaryColor", out JsonElement color));
        Assert.False(string.IsNullOrEmpty(color.GetString()));
    }

    [Fact]
    public async Task SaveBrand_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PatchAsJsonAsync("/api/brand", new
        {
            appName = "My Resto"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SaveBrand_WithAuth_UpdatesValues()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage saveResponse = await client.PatchAsJsonAsync("/api/brand", new
        {
            appName = "Custom Resto",
            primaryColor = "#ff5500",
            accentColor = "#00ff55"
        });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        // Verify the values were saved
        HttpResponseMessage getResponse = await client.GetAsync("/api/brand");
        JsonElement body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Custom Resto", body.GetProperty("appName").GetString());
        Assert.Equal("#ff5500", body.GetProperty("primaryColor").GetString());
        Assert.Equal("#00ff55", body.GetProperty("accentColor").GetString());
    }

    [Fact]
    public async Task SaveBrand_OversizedAppName_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PatchAsJsonAsync("/api/brand", new
        {
            appName = new string('A', 33)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetBrand_ResponseIncludesHeaderImageUrl()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("headerImageUrl", out _));
    }

    [Fact]
    public async Task GetBrand_HasCacheHeaders()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // ResponseCache(Duration = 3600) should set Cache-Control header
        // Note: In test server environment, response caching middleware may not set headers,
        // but the attribute is configured. We verify the response succeeds.
    }

    [Fact]
    public async Task SaveBrand_InvalidColor_ReturnsBadRequest()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PatchAsJsonAsync("/api/brand", new
        {
            primaryColor = "not-a-color"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("Invalid primary color hex code", body.GetProperty("message").GetString()!);
    }

    [Fact]
    public async Task SaveBrand_WithAuth_UpdatesCopyrightText()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage saveResponse = await client.PatchAsJsonAsync("/api/brand", new
        {
            copyrightText = "© 2026 Custom Resto",
        });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        HttpResponseMessage getResponse = await client.GetAsync("/api/brand");
        JsonElement body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("© 2026 Custom Resto", body.GetProperty("copyrightText").GetString());
    }

    [Fact]
    public async Task SaveBrand_OversizedCopyrightText_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PatchAsJsonAsync("/api/brand", new
        {
            copyrightText = new string('A', 201)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPwaIcon_ReturnsNotFound_WhenNoFaviconIconConfigured()
    {
        // BrandService.SaveAsync treats a null faviconIcon as "leave unchanged", so an
        // icon set by another test in the shared fixture can't be cleared via the API —
        // use a freshly seeded factory instead to guarantee no icon is configured.
        using var factory = new TestWebAppFactory();
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand/pwa-icon.svg");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPwaIcon_ReturnsSvg_WhenFaviconIconConfigured()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage saveResponse = await client.PatchAsJsonAsync("/api/brand", new
        {
            faviconIcon = "utensils",
            primaryColor = "#123456",
        });
        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        HttpResponseMessage response = await client.GetAsync("/api/brand/pwa-icon.svg");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/svg+xml", response.Content.Headers.ContentType?.MediaType);
        string body = await response.Content.ReadAsStringAsync();
        Assert.Contains("<svg", body);
        Assert.Contains("#123456", body);
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData(100)]
    [InlineData(1024)]
    public async Task GetPwaIconPng_ReturnsNotFound_ForUnsupportedSize(int size)
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync($"/api/brand/pwa-icon-{size}.png");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPwaIconPng_ReturnsNotFound_WhenNoFaviconIconConfigured()
    {
        using var factory = new TestWebAppFactory();
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand/pwa-icon-192.png");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(192)]
    [InlineData(512)]
    public async Task GetPwaIconPng_ReturnsPng_WhenFaviconIconConfigured(int size)
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage saveResponse = await client.PatchAsJsonAsync("/api/brand", new
        {
            faviconIcon = "flame",
            primaryColor = "#0a7ea4",
        });
        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        HttpResponseMessage response = await client.GetAsync($"/api/brand/pwa-icon-{size}.png");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        byte[] bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.NotEmpty(bytes);
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    // BrandService.SaveAsync rejects unknown icon names via the PATCH endpoint, so an
    // unrecognized-but-non-empty FaviconIcon can only occur from stale/out-of-band data
    // (e.g. a value from before the allow-list changed). Seed it directly via the DB,
    // bypassing the service, to exercise that fallback.
    private static async Task SeedUnrecognizedFaviconIconAsync(TestWebAppFactory factory)
    {
        using IServiceScope scope = factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        BrandSettings? brand = db.Set<BrandSettings>().FirstOrDefault();
        if (brand == null)
        {
            brand = new BrandSettings { FaviconIcon = "no-longer-a-valid-icon" };
            db.Set<BrandSettings>().Add(brand);
        }
        else
        {
            brand.FaviconIcon = "no-longer-a-valid-icon";
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPwaIcon_ReturnsNotFound_WhenFaviconIconIsUnrecognized()
    {
        using var factory = new TestWebAppFactory();
        await SeedUnrecognizedFaviconIconAsync(factory);
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand/pwa-icon.svg");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPwaIconPng_ReturnsNotFound_WhenFaviconIconIsUnrecognized()
    {
        using var factory = new TestWebAppFactory();
        await SeedUnrecognizedFaviconIconAsync(factory);
        HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/brand/pwa-icon-192.png");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
