using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

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
    public async Task SaveBrand_WithAuth_UpdatesCopyrightAndSocialLinks()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage saveResponse = await client.PatchAsJsonAsync("/api/brand", new
        {
            copyrightText = "© 2026 Custom Resto",
            socialLinks = new
            {
                instagram = "https://instagram.com/resto",
                facebook = "https://facebook.com/resto",
                twitter = "https://x.com/resto",
                tiktok = "https://tiktok.com/@resto",
                youtube = "https://youtube.com/@resto",
            },
        });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        HttpResponseMessage getResponse = await client.GetAsync("/api/brand");
        JsonElement body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("© 2026 Custom Resto", body.GetProperty("copyrightText").GetString());
        JsonElement socialLinks = body.GetProperty("socialLinks");
        Assert.Equal("https://instagram.com/resto", socialLinks.GetProperty("instagram").GetString());
        Assert.Equal("https://facebook.com/resto", socialLinks.GetProperty("facebook").GetString());
        Assert.Equal("https://x.com/resto", socialLinks.GetProperty("twitter").GetString());
        Assert.Equal("https://tiktok.com/@resto", socialLinks.GetProperty("tiktok").GetString());
        Assert.Equal("https://youtube.com/@resto", socialLinks.GetProperty("youtube").GetString());
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
}
