using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;
using Moq;
using OpenRestoApi.Core.Application.Services;
using SameSiteMode = Microsoft.Net.Http.Headers.SameSiteMode;

namespace OpenRestoApi.Tests.Services;

public class AuthCookieServiceTests
{
    private const string _cookieName = "openresto_auth";

    private static HttpResponse NewResponse() => new DefaultHttpContext().Response;

    private static IWebHostEnvironment Env(string name)
    {
        var mock = new Mock<IWebHostEnvironment>();
        mock.SetupGet(e => e.EnvironmentName).Returns(name);
        return mock.Object;
    }

    /// <summary>Parses the Set-Cookie header into a strongly-typed value the assertions can read.</summary>
    private static SetCookieHeaderValue ParseSingle(HttpResponse response)
    {
        string header = response.Headers.SetCookie.ToString();
        Assert.True(SetCookieHeaderValue.TryParse(header, out SetCookieHeaderValue parsed), $"Unparseable Set-Cookie: {header}");
        return parsed;
    }

    [Fact]
    public void Set_InDevelopment_WritesLaxInsecureCookie()
    {
        var svc = new AuthCookieService(Env("Development"));
        HttpResponse response = NewResponse();

        svc.Set(response, "jwt-token");

        SetCookieHeaderValue cookie = ParseSingle(response);
        Assert.Equal(_cookieName, cookie.Name.Value);
        Assert.Equal("jwt-token", cookie.Value.Value);
        Assert.True(cookie.HttpOnly);
        Assert.Equal(SameSiteMode.Lax, cookie.SameSite);
        // Secure flag is omitted in dev — its absence is what we assert.
        Assert.False(cookie.Secure);
        Assert.Equal("/", cookie.Path.Value);
        Assert.NotNull(cookie.Expires);
    }

    [Fact]
    public void Set_InProduction_WritesStrictSecureCookie()
    {
        var svc = new AuthCookieService(Env("Production"));
        HttpResponse response = NewResponse();

        svc.Set(response, "jwt-token");

        SetCookieHeaderValue cookie = ParseSingle(response);
        Assert.Equal(_cookieName, cookie.Name.Value);
        Assert.Equal("jwt-token", cookie.Value.Value);
        Assert.True(cookie.HttpOnly);
        Assert.Equal(SameSiteMode.Strict, cookie.SameSite);
        Assert.True(cookie.Secure);
        Assert.Equal("/", cookie.Path.Value);
        Assert.NotNull(cookie.Expires);
    }

    [Fact]
    public void Clear_InDevelopment_WritesExpiredDeleteCookie()
    {
        var svc = new AuthCookieService(Env("Development"));
        HttpResponse response = NewResponse();

        svc.Clear(response);

        SetCookieHeaderValue cookie = ParseSingle(response);
        Assert.Equal(_cookieName, cookie.Name.Value);
        Assert.True(string.IsNullOrEmpty(cookie.Value.Value)); // delete emits an empty value
        Assert.True(cookie.Expires.HasValue && cookie.Expires.Value.DateTime < DateTime.UtcNow);
        Assert.Equal(SameSiteMode.Lax, cookie.SameSite);
        Assert.False(cookie.Secure);
        Assert.Equal("/", cookie.Path.Value);
    }

    [Fact]
    public void Clear_InProduction_WritesExpiredDeleteCookie_StrictSecure()
    {
        var svc = new AuthCookieService(Env("Production"));
        HttpResponse response = NewResponse();

        svc.Clear(response);

        SetCookieHeaderValue cookie = ParseSingle(response);
        Assert.Equal(_cookieName, cookie.Name.Value);
        Assert.True(string.IsNullOrEmpty(cookie.Value.Value));
        Assert.Equal(SameSiteMode.Strict, cookie.SameSite);
        Assert.True(cookie.Secure);
        Assert.Equal("/", cookie.Path.Value);
    }
}
