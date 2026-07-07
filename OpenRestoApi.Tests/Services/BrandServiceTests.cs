using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class BrandServiceTests
{
    private static BrandService CreateService(AppDbContext db)
    {
        var config = new Mock<IConfiguration>();
        return new BrandService(new BrandSettingsRepository(db), config.Object);
    }

    private static BrandService CreateService(AppDbContext db, IConfiguration config)
    {
        return new BrandService(new BrandSettingsRepository(db), config);
    }

    [Fact]
    public async Task GetAsync_ReturnsDefault_WhenEmpty()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAsync_ReturnsDefault_WhenEmpty));
        var svc = CreateService(db);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Open Resto", result.AppName);
    }

    [Fact]
    public async Task GetAsync_ReturnsSeeded_WhenExists()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAsync_ReturnsSeeded_WhenExists));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Custom", PrimaryColor = "#123456" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Custom", result.AppName);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenAppNameTooLong()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenAppNameTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(new string('a', 33), null, null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidPrimaryColor()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenInvalidPrimaryColor));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(null, "invalid", null));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidAccentColor()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenInvalidAccentColor));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() => svc.SaveAsync(null, null, "invalid"));
    }

    [Fact]
    public async Task SaveAsync_Persists_NewBrandSettings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_NewBrandSettings));
        var svc = CreateService(db);
        await svc.SaveAsync("MyApp", "#123456", null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("MyApp", result.AppName);
        Assert.Equal("#123456", result.PrimaryColor);
    }

    [Fact]
    public async Task SaveAsync_Preserves_ExistingValues_WhenNullPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Preserves_ExistingValues_WhenNullPassed));
        var svc = CreateService(db);
        await svc.SaveAsync("Initial", "#123456", null);
        await svc.SaveAsync(null, null, null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Initial", result.AppName);
    }

    [Fact]
    public async Task SaveAsync_Updates_AccentColor()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Updates_AccentColor));
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
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_ValidatesHexWithAlpha));
        var svc = CreateService(db);
        await svc.SaveAsync(null, "#12345678", null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("#12345678", result.PrimaryColor);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenCopyrightTextTooLong()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenCopyrightTextTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, copyrightText: new string('a', 201)));
    }

    [Fact]
    public async Task SaveAsync_Persists_CopyrightText()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_CopyrightText));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, copyrightText: "© 2026 My Resto");
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("© 2026 My Resto", result.CopyrightText);
    }

    [Fact]
    public async Task SaveAsync_Clears_CopyrightText_WhenEmptyStringPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Clears_CopyrightText_WhenEmptyStringPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, copyrightText: "© 2026 My Resto");
        await svc.SaveAsync(null, null, null, copyrightText: "");
        BrandSettings result = await svc.GetAsync();
        Assert.Null(result.CopyrightText);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenInvalidFaviconIcon()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenInvalidFaviconIcon));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, faviconIcon: "not-a-real-icon"));
    }

    [Fact]
    public async Task SaveAsync_Persists_WebsiteUrl_Trimmed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_WebsiteUrl_Trimmed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, websiteUrl: "  https://example.com  ");
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("https://example.com", result.WebsiteUrl);
    }

    [Fact]
    public async Task SaveAsync_Clears_WebsiteUrl_WhenBlankPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Clears_WebsiteUrl_WhenBlankPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, websiteUrl: "https://example.com");
        await svc.SaveAsync(null, null, null, websiteUrl: "   ");
        BrandSettings result = await svc.GetAsync();
        Assert.Null(result.WebsiteUrl);
    }

    [Fact]
    public void GetWebsiteUrl_ReturnsBrandWebsiteUrl_WhenSet()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetWebsiteUrl_ReturnsBrandWebsiteUrl_WhenSet)));
        string result = svc.GetWebsiteUrl(new BrandSettings { WebsiteUrl = "https://brand.example.com" });
        Assert.Equal("https://brand.example.com", result);
    }

    [Fact]
    public void GetWebsiteUrl_FallsBackToConfig_WhenBrandUrlMissing()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Website:Url"]).Returns("https://configured.example.com");
        var svc = CreateService(TestDbFactory.Create(nameof(GetWebsiteUrl_FallsBackToConfig_WhenBrandUrlMissing)), config.Object);

        string result = svc.GetWebsiteUrl(null);

        Assert.Equal("https://configured.example.com", result);
    }

    [Fact]
    public void GetWebsiteUrl_FallsBackToFirstCorsOrigin_WhenConfigMissing()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Cors:Origins"]).Returns("https://cors-a.example.com, https://cors-b.example.com");
        var svc = CreateService(TestDbFactory.Create(nameof(GetWebsiteUrl_FallsBackToFirstCorsOrigin_WhenConfigMissing)), config.Object);

        string result = svc.GetWebsiteUrl(null);

        Assert.Equal("https://cors-a.example.com", result);
    }

    [Fact]
    public void GetWebsiteUrl_FallsBackToLocalhost_WhenNothingConfigured()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetWebsiteUrl_FallsBackToLocalhost_WhenNothingConfigured)));
        string result = svc.GetWebsiteUrl(null);
        Assert.Equal("http://localhost:8081", result);
    }

    [Fact]
    public async Task GetWebsiteUrlAsync_UsesPersistedBrandSettings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetWebsiteUrlAsync_UsesPersistedBrandSettings));
        db.Set<BrandSettings>().Add(new BrandSettings { WebsiteUrl = "https://persisted.example.com" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        string result = await svc.GetWebsiteUrlAsync();

        Assert.Equal("https://persisted.example.com", result);
    }
}
