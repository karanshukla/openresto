using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Moq;
using OpenRestoApi.Infrastructure.Cookies;

namespace OpenRestoApi.Tests.Cookies;

public class RecentBookingsCookieTests
{
    private readonly RecentBookingsCookie _cookie;

    public RecentBookingsCookieTests()
    {
        var provider = DataProtectionProvider.Create("Tests");
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.EnvironmentName).Returns("Development");
        _cookie = new RecentBookingsCookie(provider, env.Object);
    }

    private static CachedBookingEntry MakeEntry(string bookingRef = "test-ref", string email = "a@b.com") =>
        new(bookingRef, email, "2026-06-15T19:00:00Z", 2, "Test Restaurant", DateTime.UtcNow.ToString("O"));

    private static (HttpContext ctx, DefaultHttpContext inner) CreateContext()
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        return (ctx, ctx);
    }

    [Fact]
    public void Read_ReturnsEmpty_WhenNoCookiePresent()
    {
        var (ctx, _) = CreateContext();
        var result = _cookie.Read(ctx.Request);
        Assert.Empty(result);
    }

    [Fact]
    public void Append_ThenRead_ReturnsSameEntry()
    {
        var (ctx, inner) = CreateContext();
        var entry = MakeEntry();

        _cookie.Append(ctx.Request, ctx.Response, entry);

        // Simulate the cookie being sent back on the next request
        var cookieValue = ExtractCookieValue(ctx.Response);
        var ctx2 = CreateContextWithCookie(cookieValue);

        var result = _cookie.Read(ctx2.Request);

        Assert.Single(result);
        Assert.Equal("test-ref", result[0].BookingRef);
        Assert.Equal("a@b.com", result[0].Email);
        Assert.Equal(2, result[0].Seats);
        Assert.Equal("Test Restaurant", result[0].RestaurantName);
    }

    [Fact]
    public void Append_DoesNotDuplicate_SameBookingRef()
    {
        var (ctx, _) = CreateContext();
        var entry = MakeEntry();

        _cookie.Append(ctx.Request, ctx.Response, entry);

        // Simulate the cookie being sent back
        var cookieValue = ExtractCookieValue(ctx.Response);
        var ctx2 = CreateContextWithCookie(cookieValue);

        // Append same ref again
        _cookie.Append(ctx2.Request, ctx2.Response, entry);

        var cookieValue2 = ExtractCookieValue(ctx2.Response);
        // If no new cookie was set, the old one still has 1 entry
        var ctx3 = CreateContextWithCookie(cookieValue2 ?? cookieValue);

        var result = _cookie.Read(ctx3.Request);
        Assert.Single(result);
    }

    [Fact]
    public void Append_MultipleEntries_PreservesAll()
    {
        var (ctx, _) = CreateContext();

        _cookie.Append(ctx.Request, ctx.Response, MakeEntry("ref-1"));
        var cv1 = ExtractCookieValue(ctx.Response);
        var ctx2 = CreateContextWithCookie(cv1);

        _cookie.Append(ctx2.Request, ctx2.Response, MakeEntry("ref-2"));
        var cv2 = ExtractCookieValue(ctx2.Response);
        var ctx3 = CreateContextWithCookie(cv2);

        _cookie.Append(ctx3.Request, ctx3.Response, MakeEntry("ref-3"));
        var cv3 = ExtractCookieValue(ctx3.Response);
        var ctx4 = CreateContextWithCookie(cv3);

        var result = _cookie.Read(ctx4.Request);
        Assert.Equal(3, result.Count);
    }

    [Fact]
    public void Append_TrimsToMaxEntries()
    {
        string? cookieValue = null;

        for (var i = 0; i < 12; i++)
        {
            var ctx = cookieValue != null
                ? CreateContextWithCookie(cookieValue)
                : CreateContext().ctx;

            _cookie.Append(ctx.Request, ctx.Response, MakeEntry($"ref-{i}", $"user{i}@test.com"));
            cookieValue = ExtractCookieValue(ctx.Response) ?? cookieValue;
        }

        var finalCtx = CreateContextWithCookie(cookieValue!);
        var result = _cookie.Read(finalCtx.Request);

        Assert.True(result.Count <= 10, $"Expected at most 10 entries but got {result.Count}");
    }

    [Fact]
    public void Read_ReturnsEmpty_ForCorruptedCookie()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Append("Cookie", "openresto_recent=corrupted-garbage-value");

        var result = _cookie.Read(ctx.Request);
        Assert.Empty(result);
    }

    [Fact]
    public void Read_ReturnsEmpty_ForEmptyCookie()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Append("Cookie", "openresto_recent=");

        var result = _cookie.Read(ctx.Request);
        Assert.Empty(result);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static string? ExtractCookieValue(HttpResponse response)
    {
        if (!response.Headers.TryGetValue("Set-Cookie", out var values))
            return null;

        foreach (var header in values)
        {
            if (header == null || !header.StartsWith("openresto_recent=")) continue;
            var valueEnd = header.IndexOf(';');
            var value = valueEnd >= 0
                ? header["openresto_recent=".Length..valueEnd]
                : header["openresto_recent=".Length..];
            return value;
        }
        return null;
    }

    private static DefaultHttpContext CreateContextWithCookie(string cookieValue)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Append("Cookie", $"openresto_recent={cookieValue}");
        ctx.Response.Body = new MemoryStream();
        return ctx;
    }
}
