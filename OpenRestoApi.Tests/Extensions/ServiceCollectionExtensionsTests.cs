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
