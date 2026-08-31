using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Extensions;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Tests.Extensions;

public class ServiceCollectionExtensionsTests
{
    [Fact]
    public void AddCustomCors_ThrowsOnWildcard()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().Build();
        Environment.SetEnvironmentVariable("CORS_ORIGINS", "*");
        try
        {
            Assert.Throws<InvalidOperationException>(() => services.AddCustomCors(config));
        }
        finally
        {
            Environment.SetEnvironmentVariable("CORS_ORIGINS", null);
        }
    }

    [Fact]
    public void AddCustomCors_HandlesSpecificOrigins()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:Origins"] = "http://localhost:3000,http://example.com"
            })
            .Build();

        services.AddCustomCors(config);
    }

    // ── The guest booking-lookup ceiling ────────────────────────────────────
    //
    // A booking reference is a guessable secret with no account behind it, so the two endpoints
    // that take one are throttled like login rather than like browsing. The ceiling is defence in
    // depth on top of the reference's width, never instead of it — see BookingRefGenerator.

    [Fact]
    public void BookingLookupLimit_IsAsTightAsTheLoginLimit()
    {
        Assert.True(ServiceCollectionExtensions.BookingLookupLimit <= ServiceCollectionExtensions.AuthLimit);
    }

    [Fact]
    public void BookingLookupLimit_IsFarTighterThanPublicBrowsing()
    {
        Assert.True(ServiceCollectionExtensions.BookingLookupLimit * 10 <= ServiceCollectionExtensions.PublicLimit);
    }

    [Fact]
    public void BookingLookupLimit_LeavesRoomForAGuestRetryingATypo()
    {
        // The other side of the boundary: tight enough to matter, loose enough that a guest who
        // mistypes their email two or three times and then cancels is nowhere near the ceiling.
        Assert.True(ServiceCollectionExtensions.BookingLookupLimit >= 5);
    }

    [Fact]
    public void BookingLookupLimit_KeepsTheTestingEscapeHatch()
    {
        // The Playwright suite drives the whole app from one address; every policy is lifted to
        // TestingLimit under ASPNETCORE_ENVIRONMENT=Testing, and this one must not be the
        // exception that starts returning 429 mid-suite.
        Assert.Equal(10000, ServiceCollectionExtensions.TestingLimit);
        Assert.True(ServiceCollectionExtensions.TestingLimit > ServiceCollectionExtensions.BookingLookupLimit);
    }

    [Fact]
    public void AddCustomRateLimiting_HandlesProduction()
    {
        var services = new ServiceCollection();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        services.AddCustomRateLimiting(envMock.Object);
    }

    // ── Global-limiter partitioning (issue #319 Phase 2 review fix) ──────────
    //
    // The limiter runs pre-authentication, so it can only judge the header's shape, never whether
    // the key is real. Partitioning on the header's own value let an attacker rotate garbage
    // values to mint unlimited fresh buckets, escaping the per-IP global ceiling entirely;
    // accepting any non-empty value then let one junk header lift an anonymous client's own
    // ceiling to the elevated one. So: the value must parse as a key this scheme could have
    // issued to reach the elevated bucket, and every such request from an IP shares one bucket.

    private static HttpContext ContextFor(string ip, string? apiKeyHeaderValue = null)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);
        if (apiKeyHeaderValue is not null)
        {
            context.Request.Headers[ApiKeyClaimTypes.HeaderName] = apiKeyHeaderValue;
        }
        return context;
    }

    [Fact]
    public void GlobalPartitionKey_RotatingTheHeaderValueStaysInOneBucketPerIp()
    {
        string first = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("203.0.113.5", "orst_1_aaaa"));
        string second = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("203.0.113.5", "orst_2_completely-different-garbage"));

        Assert.Equal(first, second);
        Assert.StartsWith(ServiceCollectionExtensions.ApiKeyIpPartitionPrefix, first, StringComparison.Ordinal);
    }

    [Fact]
    public void GlobalPartitionKey_DifferentIpsWithTheSameHeaderGetDifferentBuckets()
    {
        string first = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("203.0.113.5", "orst_1_aaaa"));
        string second = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("198.51.100.9", "orst_1_aaaa"));

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void GlobalPartitionKey_NoHeaderUsesThePlainIpBucket()
    {
        string key = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("203.0.113.5"));

        Assert.Equal("203.0.113.5", key);
        Assert.DoesNotContain(ServiceCollectionExtensions.ApiKeyIpPartitionPrefix, key, StringComparison.Ordinal);
    }

    [Fact]
    public void GlobalPartitionKey_AMalformedHeaderUsesThePlainIpBucket()
    {
        string key = ServiceCollectionExtensions.GlobalPartitionKey(ContextFor("203.0.113.5", "x"));

        Assert.Equal("203.0.113.5", key);
        Assert.DoesNotContain(ServiceCollectionExtensions.ApiKeyIpPartitionPrefix, key, StringComparison.Ordinal);
    }

    [Fact]
    public void GlobalPartitionKey_AWellFormedKeyUsesTheElevatedBucket()
    {
        string key = ServiceCollectionExtensions.GlobalPartitionKey(
            ContextFor("203.0.113.5", ApiKeyCrypto.GenerateRawKey(7)));

        Assert.Equal($"{ServiceCollectionExtensions.ApiKeyIpPartitionPrefix}203.0.113.5", key);
    }

    [Fact]
    public void AddCustomAuthentication_UsesEnvVar()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().Build();
        Environment.SetEnvironmentVariable("JWT_KEY", "SOME_VERY_LONG_KEY_FOR_TESTING_PURPOSES_ONLY");
        try
        {
            services.AddCustomAuthentication(config);
        }
        finally
        {
            Environment.SetEnvironmentVariable("JWT_KEY", null);
        }
    }

    [Fact]
    public void AddCustomAuthentication_Throws_WhenJwtKeyMissing()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().Build();
        Environment.SetEnvironmentVariable("JWT_KEY", null);

        InvalidOperationException ex = Assert.Throws<InvalidOperationException>(() => services.AddCustomAuthentication(config));
        Assert.Contains("Jwt:Key must be set", ex.Message);
    }

    [Fact]
    public void AddCustomAuthentication_Throws_WhenJwtKeyTooShort()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = "too-short" })
            .Build();

        InvalidOperationException ex = Assert.Throws<InvalidOperationException>(() => services.AddCustomAuthentication(config));
        Assert.Contains("at least 32 characters", ex.Message);
    }

    [Fact]
    public void AddProjectDependencies_RegistersExpectedServices()
    {
        var services = new ServiceCollection();
        services.AddProjectDependencies();
        // Just verify it doesn't throw
        using ServiceProvider provider = services.BuildServiceProvider();
        Assert.NotNull(provider);
    }

    // ── DI-lifetime safety net (#135) ───────────────────────────────────────
    // HoldService is deliberately registered as a Singleton (its in-memory hold
    // dictionary must survive across requests — see ServiceCollectionExtensions.cs),
    // while IRestaurantRepository/AppDbContext (and every other repository/service)
    // are Scoped. Injecting a Scoped dependency into HoldService's constructor would
    // be a captive-dependency violation that ASP.NET Core's default container only
    // catches via scope validation, which is enabled by default in Development but
    // NOT by a plain `BuildServiceProvider()` call (as used above) — so a regression
    // here would previously only surface as a runtime `InvalidOperationException`
    // once someone ran the app in Development, not during `dotnet test`.
    //
    // This test builds the container with `validateScopes: true` (the same mechanism
    // ASP.NET Core's host uses) and resolves `IHoldService` from the root provider.
    // If HoldService's constructor is ever changed to depend on a Scoped service,
    // this resolution throws immediately and this test fails loudly instead of only
    // failing at runtime.
    [Fact]
    public void AddProjectDependencies_HoldServiceSingleton_ResolvesCleanly_WithScopeValidationEnabled()
    {
        var services = new ServiceCollection();
        services.AddProjectDependencies();

        using ServiceProvider provider = services.BuildServiceProvider(validateScopes: true);

        IHoldService holdService = provider.GetRequiredService<IHoldService>();
        Assert.NotNull(holdService);

        // Resolving from a nested scope must yield the exact same singleton instance —
        // confirms it wasn't (and can't be) silently re-created per-scope/per-request.
        using IServiceScope scope = provider.CreateScope();
        IHoldService scopedHoldService = scope.ServiceProvider.GetRequiredService<IHoldService>();
        Assert.Same(holdService, scopedHoldService);
    }

    [Fact]
    public void AddProjectDependencies_ConfiguresSessionCookieOptions()
    {
        var services = new ServiceCollection();
        services.AddProjectDependencies();
        using ServiceProvider provider = services.BuildServiceProvider();

        // Resolving IOptions<SessionOptions> triggers the AddSession(...) configure delegate.
        var sessionOptions = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<Microsoft.AspNetCore.Builder.SessionOptions>>().Value;

        Assert.Equal(TimeSpan.FromSeconds(10), sessionOptions.IdleTimeout);
        Assert.True(sessionOptions.Cookie.HttpOnly);
        Assert.True(sessionOptions.Cookie.IsEssential);
    }

    [Fact]
    public void AddProjectDependencies_PersistsKeysWhenPathEnvVarSet()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        Environment.SetEnvironmentVariable("DATA_PROTECTION_KEYS_PATH", tmpDir);
        try
        {
            var services = new ServiceCollection();
            services.AddProjectDependencies();
            using var provider = services.BuildServiceProvider();
            // Calling Protect triggers key ring initialisation, which writes the key XML to disk
            provider.GetRequiredService<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>()
                .CreateProtector("test")
                .Protect(System.Text.Encoding.UTF8.GetBytes("data"));
            Assert.NotEmpty(Directory.GetFiles(tmpDir, "*.xml"));
        }
        finally
        {
            Environment.SetEnvironmentVariable("DATA_PROTECTION_KEYS_PATH", null);
            Directory.Delete(tmpDir, recursive: true);
        }
    }
}
