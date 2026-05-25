using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class BrandServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    private static BrandService CreateService(AppDbContext db)
    {
        var config = new Mock<IConfiguration>();
        return new BrandService(db, config.Object);
    }

    [Fact]
    public async Task GetAsync_ReturnsDefault_WhenEmpty()
    {
        using AppDbContext db = CreateDb(nameof(GetAsync_ReturnsDefault_WhenEmpty));
        var svc = CreateService(db);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Open Resto", result.AppName);
    }

    [Fact]
    public async Task GetAsync_ReturnsSeeded_WhenExists()
    {
        using AppDbContext db = CreateDb(nameof(GetAsync_ReturnsSeeded_WhenExists));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Custom", PrimaryColor = "#123456" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Custom", result.AppName);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenAppNameTooLong()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Throws_WhenAppNameTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(new string('a', 33), null, null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidPrimaryColor()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Throws_WhenInvalidPrimaryColor));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(null, "invalid", null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidAccentColor()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Throws_WhenInvalidAccentColor));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(null, null, "invalid"));
    }

    [Fact]
    public async Task SaveAsync_Persists_NewBrandSettings()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Persists_NewBrandSettings));
        var svc = CreateService(db);
        await svc.SaveAsync("MyApp", "#123456", null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("MyApp", result.AppName);
        Assert.Equal("#123456", result.PrimaryColor);
    }

    [Fact]
    public async Task SaveAsync_Preserves_ExistingValues_WhenNullPassed()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Preserves_ExistingValues_WhenNullPassed));
        var svc = CreateService(db);
        await svc.SaveAsync("Initial", "#123456", null);
        await svc.SaveAsync(null, null, null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Initial", result.AppName);
    }

    [Fact]
    public async Task SaveAsync_Updates_AccentColor()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_Updates_AccentColor));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Test", PrimaryColor = "#123456" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        await svc.SaveAsync(null, null, "#abcdef");
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("#abcdef", result.AccentColor);
    }

    [Fact]
    public async Task SaveAsync_ValidatesHexWithAlpha()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_ValidatesHexWithAlpha));
        var svc = CreateService(db);
        await svc.SaveAsync(null, "#12345678", null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("#12345678", result.PrimaryColor);
    }
}
