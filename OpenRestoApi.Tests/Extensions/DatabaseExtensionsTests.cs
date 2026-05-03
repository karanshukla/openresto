using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Extensions;
using Xunit;

namespace OpenRestoApi.Tests.Extensions;

public class DatabaseExtensionsTests
{
    [Fact]
    public void GetAppConnectionString_UsesConfigValue_WhenPresent()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = "ConnStr" })
            .Build();
        var env = new Mock<IWebHostEnvironment>().Object;

        var result = config.GetAppConnectionString(env);

        Assert.Equal("ConnStr", result);
    }

    [Fact]
    public void GetAppConnectionString_UsesEnvVar_WhenConfigMissing()
    {
        var config = new ConfigurationBuilder().Build();
        var env = new Mock<IWebHostEnvironment>().Object;
        Environment.SetEnvironmentVariable("CONNECTION_STRING", "EnvStr");

        try
        {
            var result = config.GetAppConnectionString(env);
            Assert.Equal("EnvStr", result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("CONNECTION_STRING", null);
        }
    }

    [Fact]
    public void GetAppConnectionString_UsesDefault_WhenAllMissing()
    {
        var config = new ConfigurationBuilder().Build();
        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var result = config.GetAppConnectionString(envMock.Object);
        Assert.Equal("Data Source=./openresto.db", result);
        
        envMock.Setup(e => e.EnvironmentName).Returns("Production");
        result = config.GetAppConnectionString(envMock.Object);
        Assert.Equal("Data Source=/data/openresto.db", result);
    }
}
