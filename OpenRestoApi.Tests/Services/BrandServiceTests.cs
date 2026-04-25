using Microsoft.EntityFrameworkCore;
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

    [Fact]
    public async Task GetAsync_ReturnsDefault_WhenEmpty()
    {
        using var db = CreateDb(nameof(GetAsync_ReturnsDefault_WhenEmpty));
        var svc = new BrandService(db);
        var result = await svc.GetAsync();
        Assert.Equal("Open Resto", result.AppName);
    }

    [Fact]
    public async Task GetAsync_ReturnsSeeded_WhenExists()
    {
        using var db = CreateDb(nameof(GetAsync_ReturnsSeeded_WhenExists));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Custom", PrimaryColor = "#123456" });
        await db.SaveChangesAsync();

        var svc = new BrandService(db);
        var result = await svc.GetAsync();
        Assert.Equal("Custom", result.AppName);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenAppNameTooLong()
    {
        using var db = CreateDb(nameof(SaveAsync_Throws_WhenAppNameTooLong));
        var svc = new BrandService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(new string('a', 33), null, null, null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidPrimaryColor()
    {
        using var db = CreateDb(nameof(SaveAsync_Throws_WhenInvalidPrimaryColor));
        var svc = new BrandService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(null, "invalid", null, null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidAccentColor()
    {
        using var db = CreateDb(nameof(SaveAsync_Throws_WhenInvalidAccentColor));
        var svc = new BrandService(db);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(null, null, "invalid", null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenLogoTooLarge()
    {
        using var db = CreateDb(nameof(SaveAsync_Throws_WhenLogoTooLarge));
        var svc = new BrandService(db);
        string largeBase64 = new string('a', 400000);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveAsync(null, null, null, largeBase64));
    }

    [Fact]
    public async Task SaveAsync_HandlesLogoWithComma()
    {
        using var db = CreateDb(nameof(SaveAsync_HandlesLogoWithComma));
        var svc = new BrandService(db);
        await svc.SaveAsync(null, null, null, "data:image/png;base64,iVBORw0KGgo=");
        var result = await svc.GetAsync();
        Assert.Equal("data:image/png;base64,iVBORw0KGgo=", result.LogoBase64);
    }

    [Fact]
    public async Task SaveAsync_SetsLogoNull_WhenEmptyString()
    {
        using var db = CreateDb(nameof(SaveAsync_SetsLogoNull_WhenEmptyString));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Test", PrimaryColor = "#123456", LogoBase64 = "existing" });
        await db.SaveChangesAsync();

        var svc = new BrandService(db);
        await svc.SaveAsync(null, null, null, "");
        var result = await svc.GetAsync();
        Assert.Null(result.LogoBase64);
    }

    [Fact]
    public async Task SaveAsync_ValidatesHexWithAlpha()
    {
        using var db = CreateDb(nameof(SaveAsync_ValidatesHexWithAlpha));
        var svc = new BrandService(db);
        await svc.SaveAsync(null, "#12345678", null, null);
        var result = await svc.GetAsync();
        Assert.Equal("#12345678", result.PrimaryColor);
    }
}
