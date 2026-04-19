using System.Net;

namespace OpenRestoApi.Tests.Integration;

public class SecurityHeaderTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;

    public SecurityHeaderTests(TestWebAppFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task AllResponses_ShouldHaveSecurityHeaders()
    {
        // Act
        var response = await _client.GetAsync("/api/brand");

        // Assert
        Assert.True(response.Headers.Contains("X-Content-Type-Options"), "Missing X-Content-Type-Options");
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").First());

        Assert.True(response.Headers.Contains("X-Frame-Options"), "Missing X-Frame-Options");
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").First());

        Assert.True(response.Headers.Contains("Referrer-Policy"), "Missing Referrer-Policy");
        Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").First());

        Assert.True(response.Headers.Contains("Content-Security-Policy"), "Missing Content-Security-Policy");

        Assert.True(response.Headers.Contains("X-XSS-Protection"), "Missing X-XSS-Protection");
        Assert.Equal("1; mode=block", response.Headers.GetValues("X-XSS-Protection").First());

        // These might be missing and ZAP might be flagging them
        Assert.True(response.Headers.Contains("Strict-Transport-Security"), "Missing Strict-Transport-Security (HSTS)");

        Assert.True(response.Headers.Contains("Cross-Origin-Resource-Policy"), "Missing Cross-Origin-Resource-Policy");
        Assert.Equal("same-origin", response.Headers.GetValues("Cross-Origin-Resource-Policy").First());

        Assert.True(response.Headers.Contains("Cache-Control"), "Missing Cache-Control");
        Assert.Contains("no-store", response.Headers.GetValues("Cache-Control").First());
    }

    [Fact]
    public async Task Responses_ShouldNotHaveInformationLeakingHeaders()
    {
        // Act
        var response = await _client.GetAsync("/api/brand");

        // Assert
        Assert.False(response.Headers.Contains("Server"), "Server header should be removed");
        Assert.False(response.Headers.Contains("X-Powered-By"), "X-Powered-By header should be removed");
    }
}
