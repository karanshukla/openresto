using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Extensions;

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

    [Fact]
    public void AddCustomRateLimiting_HandlesProduction()
    {
        var services = new ServiceCollection();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");
        
        services.AddCustomRateLimiting(envMock.Object);
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
    public void AddProjectDependencies_RegistersExpectedServices()
    {
        var services = new ServiceCollection();
        services.AddProjectDependencies();
        // Just verify it doesn't throw
    }
}
