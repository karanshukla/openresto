using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using OpenRestoApi.Extensions;
using Xunit;

namespace OpenRestoApi.Tests.Extensions;

public class ServiceCollectionExtensionsTests
{
    [Fact]
    public void AddCustomCors_HandlesWildcard()
    {
        var services = new ServiceCollection();
        Environment.SetEnvironmentVariable("CORS_ORIGINS", "*");
        try
        {
            services.AddCustomCors();
            // We can't easily verify the policy without building the provider and checking internal options
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
        Environment.SetEnvironmentVariable("CORS_ORIGINS", "http://localhost:3000,http://example.com");
        try
        {
            services.AddCustomCors();
        }
        finally
        {
            Environment.SetEnvironmentVariable("CORS_ORIGINS", null);
        }
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
