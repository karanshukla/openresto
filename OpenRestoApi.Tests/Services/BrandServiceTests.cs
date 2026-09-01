using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
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
    public async Task SaveAsync_Clears_FaviconIcon_WhenBlankPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Clears_FaviconIcon_WhenBlankPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, faviconIcon: "utensils");
        await svc.SaveAsync(null, null, null, faviconIcon: "");
        BrandSettings result = await svc.GetAsync();
        Assert.Null(result.FaviconIcon);
    }

    [Fact]
    public async Task SaveAsync_Keeps_FaviconIcon_WhenNullPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Keeps_FaviconIcon_WhenNullPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, faviconIcon: "utensils");
        await svc.SaveAsync("Renamed", null, null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("utensils", result.FaviconIcon);
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

    // ── Subtitle (#183) ───────────────────────────────────────────────────────

    [Fact]
    public async Task SaveAsync_Throws_WhenSubtitleTooLong()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenSubtitleTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, subtitle: new string('a', 161)));
    }

    [Fact]
    public async Task SaveAsync_Persists_Subtitle_Trimmed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_Subtitle_Trimmed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, subtitle: "  A cozy neighborhood spot  ");
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("A cozy neighborhood spot", result.Subtitle);
    }

    [Fact]
    public async Task SaveAsync_Clears_Subtitle_WhenBlankPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Clears_Subtitle_WhenBlankPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, subtitle: "A tagline");
        await svc.SaveAsync(null, null, null, subtitle: "   ");
        BrandSettings result = await svc.GetAsync();
        Assert.Null(result.Subtitle);
    }

    // ── Highlights heading / subheading (#185) ────────────────────────────────

    [Fact]
    public async Task SaveAsync_Persists_HighlightsHeading_AndSubheading()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_HighlightsHeading_AndSubheading));
        var svc = CreateService(db);
        await svc.SaveAsync(
            null, null, null,
            highlightsHeading: "What we love",
            highlightsSubheading: "Picked fresh weekly");
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("What we love", result.HighlightsHeading);
        Assert.Equal("Picked fresh weekly", result.HighlightsSubheading);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenHighlightsHeadingTooLong()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenHighlightsHeadingTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, highlightsHeading: new string('a', 61)));
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenHighlightsSubheadingTooLong()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenHighlightsSubheadingTooLong));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, highlightsSubheading: new string('a', 61)));
    }

    // ── Header image fit (#187) ───────────────────────────────────────────────

    [Theory]
    [InlineData("Cover")]
    [InlineData("Contain")]
    [InlineData("cover")]   // case-insensitive, normalized to canonical casing
    [InlineData("CONTAIN")]
    public async Task SaveAsync_Persists_HeaderImageFit_WhenAllowed(string fit)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Persists_HeaderImageFit_WhenAllowed) + fit);
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, headerImageFit: fit);
        BrandSettings result = await svc.GetAsync();
        Assert.NotNull(result.HeaderImageFit);
        // Canonical casing (first-letter-capitalized form from the allow-list)
        Assert.Equal(System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(fit.ToLower()),
            result.HeaderImageFit);
    }

    [Fact]
    public async Task SaveAsync_Throws_WhenHeaderImageFitInvalid()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Throws_WhenHeaderImageFitInvalid));
        var svc = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, headerImageFit: "fill"));
    }

    [Fact]
    public async Task SaveAsync_Clears_HeaderImageFit_WhenBlankPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Clears_HeaderImageFit_WhenBlankPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, headerImageFit: "Contain");
        await svc.SaveAsync(null, null, null, headerImageFit: "   ");
        BrandSettings result = await svc.GetAsync();
        Assert.Null(result.HeaderImageFit);
    }

    [Fact]
    public async Task SaveAsync_Preserves_HeaderImageFit_WhenNullPassed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_Preserves_HeaderImageFit_WhenNullPassed));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, headerImageFit: "Contain");
        await svc.SaveAsync(null, null, null, headerImageFit: null);
        BrandSettings result = await svc.GetAsync();
        Assert.Equal("Contain", result.HeaderImageFit);
    }

    [Fact]
    public void AllowedHeaderImageFits_ContainsCoverAndContain()
    {
        Assert.Contains("Cover", BrandService.AllowedHeaderImageFits);
        Assert.Contains("Contain", BrandService.AllowedHeaderImageFits);
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

    // ── GetDefaultLocale (#371) ────────────────────────────────────────────────

    [Fact]
    public void GetDefaultLocale_UsesEnvVar_WhenSupported()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_UsesEnvVar_WhenSupported)));
        Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", "fr");

        try
        {
            string result = svc.GetDefaultLocale();
            Assert.Equal("fr", result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", null);
        }
    }

    [Fact]
    public void GetDefaultLocale_FallsBackToEnglish_WhenEnvVarUnsupported()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_FallsBackToEnglish_WhenEnvVarUnsupported)));
        Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", "klingon");

        try
        {
            string result = svc.GetDefaultLocale();
            Assert.Equal("en", result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", null);
        }
    }

    [Fact]
    public void GetDefaultLocale_FallsBackToEnglish_WhenUnset()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_FallsBackToEnglish_WhenUnset)));
        Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", null);

        string result = svc.GetDefaultLocale();

        Assert.Equal("en", result);
    }

    [Fact]
    public void GetDefaultLocale_ConfigTakesPriority_OverEnvVar()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Locale:Default"]).Returns("de");
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_ConfigTakesPriority_OverEnvVar)), config.Object);
        Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", "es");

        try
        {
            string result = svc.GetDefaultLocale();
            Assert.Equal("de", result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", null);
        }
    }

    [Fact]
    public void GetDefaultLocale_NormalisesCaseAndWhitespace()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Locale:Default"]).Returns("  ES  ");
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_NormalisesCaseAndWhitespace)), config.Object);

        string result = svc.GetDefaultLocale();

        Assert.Equal("es", result);
    }

    [Fact]
    public void GetDefaultLocale_UnusedBrandParameter_DoesNotAffectResolution()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetDefaultLocale_UnusedBrandParameter_DoesNotAffectResolution)));
        Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", "fr");

        try
        {
            string result = svc.GetDefaultLocale(new BrandSettings { AppName = "Ignored" });
            Assert.Equal("fr", result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE", null);
        }
    }

    // ── Project links (#409) ───────────────────────────────────────────────────

    [Fact]
    public void GetCliPackageUrl_UsesConfiguredValue()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:CliPackage"]).Returns("https://npm.example.com/package/fork-cli");
        var svc = CreateService(TestDbFactory.Create(nameof(GetCliPackageUrl_UsesConfiguredValue)), config.Object);

        Assert.Equal("https://npm.example.com/package/fork-cli", svc.GetCliPackageUrl());
    }

    [Fact]
    public void GetCliPackageUrl_UsesEnvVar_WhenConfigMissing()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetCliPackageUrl_UsesEnvVar_WhenConfigMissing)));
        Environment.SetEnvironmentVariable("OPENRESTO_CLI_PACKAGE_URL", "https://npm.example.com/package/env-cli");

        try
        {
            Assert.Equal("https://npm.example.com/package/env-cli", svc.GetCliPackageUrl());
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_CLI_PACKAGE_URL", null);
        }
    }

    [Fact]
    public void GetApiDocsUrl_ConfigTakesPriority_OverEnvVar()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:ApiDocs"]).Returns("https://docs.example.com/http");
        var svc = CreateService(TestDbFactory.Create(nameof(GetApiDocsUrl_ConfigTakesPriority_OverEnvVar)), config.Object);
        Environment.SetEnvironmentVariable("OPENRESTO_API_DOCS_URL", "https://ignored.example.com");

        try
        {
            Assert.Equal("https://docs.example.com/http", svc.GetApiDocsUrl());
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENRESTO_API_DOCS_URL", null);
        }
    }

    [Fact]
    public void GetApiDocsUrl_TrimsSurroundingWhitespace()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:ApiDocs"]).Returns("  https://docs.example.com/http  ");
        var svc = CreateService(TestDbFactory.Create(nameof(GetApiDocsUrl_TrimsSurroundingWhitespace)), config.Object);

        Assert.Equal("https://docs.example.com/http", svc.GetApiDocsUrl());
    }

    [Fact]
    public void GetRepositoryUrl_UsesConfiguredValue()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:Repository"]).Returns("http://git.example.com/fork");
        var svc = CreateService(TestDbFactory.Create(nameof(GetRepositoryUrl_UsesConfiguredValue)), config.Object);

        Assert.Equal("http://git.example.com/fork", svc.GetRepositoryUrl());
    }

    [Fact]
    public void GetRepositoryUrl_FallsBackToUpstream_WhenUnset()
    {
        var svc = CreateService(TestDbFactory.Create(nameof(GetRepositoryUrl_FallsBackToUpstream_WhenUnset)));

        Assert.Equal("https://github.com/karanshukla/openresto", svc.GetRepositoryUrl());
        Assert.Equal("https://www.npmjs.com/package/openresto-cli", svc.GetCliPackageUrl());
        Assert.Equal(
            "https://github.com/karanshukla/openresto/blob/main/docs/http-api.md",
            svc.GetApiDocsUrl());
    }

    [Fact]
    public void GetRepositoryUrl_IgnoresNonWebScheme()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:Repository"]).Returns("javascript:alert(1)");
        var svc = CreateService(TestDbFactory.Create(nameof(GetRepositoryUrl_IgnoresNonWebScheme)), config.Object);

        Assert.Equal("https://github.com/karanshukla/openresto", svc.GetRepositoryUrl());
    }

    [Fact]
    public void GetRepositoryUrl_IgnoresBlankValue()
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["Links:Repository"]).Returns("   ");
        var svc = CreateService(TestDbFactory.Create(nameof(GetRepositoryUrl_IgnoresBlankValue)), config.Object);

        Assert.Equal("https://github.com/karanshukla/openresto", svc.GetRepositoryUrl());
    }

    [Theory]
    [InlineData("openres.to/privacy")]
    [InlineData("/privacy")]
    [InlineData("javascript:alert(1)")]
    [InlineData("mailto:privacy@openres.to")]
    public async Task SaveAsync_Throws_WhenPrivacyPolicyUrlIsNotAnAbsoluteWebUrl(string url)
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(SaveAsync_Throws_WhenPrivacyPolicyUrlIsNotAnAbsoluteWebUrl) + url);
        var svc = CreateService(db);

        ValidationException error = await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, privacyPolicyUrl: url));

        Assert.Equal(ErrorCodes.BrandPrivacyPolicyUrlInvalid, error.Code);
    }

    [Fact]
    public async Task SaveAsync_PersistsPrivacyPolicyUrl()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_PersistsPrivacyPolicyUrl));
        var svc = CreateService(db);

        await svc.SaveAsync(null, null, null, privacyPolicyUrl: " https://openres.to/privacy ");

        Assert.Equal("https://openres.to/privacy", (await svc.GetAsync()).PrivacyPolicyUrl);
    }

    [Fact]
    public async Task SaveAsync_ClearsPrivacyPolicyUrl_WhenBlank()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_ClearsPrivacyPolicyUrl_WhenBlank));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, privacyPolicyUrl: "https://openres.to/privacy");

        await svc.SaveAsync(null, null, null, privacyPolicyUrl: "");

        Assert.Null((await svc.GetAsync()).PrivacyPolicyUrl);
    }

    [Theory]
    [InlineData("1.9")]
    [InlineData("v1.9.0")]
    [InlineData("1.9.0-beta")]
    [InlineData("latest")]
    public async Task SaveAsync_Throws_WhenMinimumAppVersionIsNotMajorMinorPatch(string version)
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(SaveAsync_Throws_WhenMinimumAppVersionIsNotMajorMinorPatch) + version);
        var svc = CreateService(db);

        ValidationException error = await Assert.ThrowsAsync<ValidationException>(
            () => svc.SaveAsync(null, null, null, minimumAppVersion: version));

        Assert.Equal(ErrorCodes.BrandMinimumAppVersionInvalid, error.Code);
    }

    [Fact]
    public async Task SaveAsync_PersistsMinimumAppVersion()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_PersistsMinimumAppVersion));
        var svc = CreateService(db);

        await svc.SaveAsync(null, null, null, minimumAppVersion: "1.9.0");

        Assert.Equal("1.9.0", (await svc.GetAsync()).MinimumAppVersion);
    }

    [Fact]
    public async Task SaveAsync_ClearsMinimumAppVersion_WhenBlank()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SaveAsync_ClearsMinimumAppVersion_WhenBlank));
        var svc = CreateService(db);
        await svc.SaveAsync(null, null, null, minimumAppVersion: "1.9.0");

        await svc.SaveAsync(null, null, null, minimumAppVersion: "   ");

        Assert.Null((await svc.GetAsync()).MinimumAppVersion);
    }
}
