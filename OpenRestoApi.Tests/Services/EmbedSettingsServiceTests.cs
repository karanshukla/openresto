using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class EmbedSettingsServiceTests
{
    private static EmbedSettingsService CreateService(AppDbContext db)
        => new(new BrandSettingsRepository(db));

    private static UpdateEmbedSettingsRequest Request(params string[] origins)
        => new() { AllowedOrigins = [.. origins] };

    [Fact]
    public async Task Get_ReturnsNoOriginsBeforeAnyBrandIsSaved()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Get_ReturnsNoOriginsBeforeAnyBrandIsSaved));

        EmbedSettingsDto settings = await CreateService(db).GetAsync();

        Assert.Empty(settings.AllowedOrigins);
        Assert.Equal("'none'", await CreateService(db).GetFrameAncestorsAsync());
    }

    [Fact]
    public async Task Update_StoresCanonicalOriginsOnce()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_StoresCanonicalOriginsOnce));
        db.Set<BrandSettings>().Add(new BrandSettings());
        await db.SaveChangesAsync();
        EmbedSettingsService svc = CreateService(db);

        EmbedSettingsDto saved = await svc.UpdateAsync(
            Request("https://Bistro.example/", "https://bistro.example", "http://localhost:4321"));

        Assert.Equal(["https://bistro.example", "http://localhost:4321"], saved.AllowedOrigins);
        Assert.Equal("https://bistro.example http://localhost:4321", await svc.GetFrameAncestorsAsync());
    }

    [Fact]
    public async Task Update_CreatesTheBrandRowWhenThereIsNone()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_CreatesTheBrandRowWhenThereIsNone));

        await CreateService(db).UpdateAsync(Request("https://bistro.example"));

        Assert.Equal("https://bistro.example", db.Set<BrandSettings>().Single().EmbedOrigins);
    }

    [Fact]
    public async Task Update_WithAnEmptyListClearsTheColumn()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_WithAnEmptyListClearsTheColumn));
        db.Set<BrandSettings>().Add(new BrandSettings { EmbedOrigins = "https://bistro.example" });
        await db.SaveChangesAsync();

        await CreateService(db).UpdateAsync(Request());

        Assert.Null(db.Set<BrandSettings>().Single().EmbedOrigins);
    }

    [Fact]
    public async Task Update_RejectsSomethingThatIsNotAnOrigin()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_RejectsSomethingThatIsNotAnOrigin));

        ValidationException error = await Assert.ThrowsAsync<ValidationException>(
            () => CreateService(db).UpdateAsync(Request("https://bistro.example/book")));

        Assert.Equal(ErrorCodes.EmbedOriginInvalid, error.Code);
        Assert.Equal("https://bistro.example/book", error.Args!["origin"]);
    }

    [Fact]
    public async Task Update_AcceptsExactlyTheCap()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_AcceptsExactlyTheCap));
        string[] origins = [.. Enumerable.Range(1, EmbedOrigins.MaxCount).Select(i => $"https://site{i}.example")];

        EmbedSettingsDto saved = await CreateService(db).UpdateAsync(Request(origins));

        Assert.Equal(EmbedOrigins.MaxCount, saved.AllowedOrigins.Count);
    }

    [Fact]
    public async Task Update_RejectsMoreThanTheCap()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(Update_RejectsMoreThanTheCap));
        string[] origins = [.. Enumerable.Range(1, EmbedOrigins.MaxCount + 1).Select(i => $"https://site{i}.example")];

        ValidationException error = await Assert.ThrowsAsync<ValidationException>(
            () => CreateService(db).UpdateAsync(Request(origins)));

        Assert.Equal(ErrorCodes.EmbedTooManyOrigins, error.Code);
    }
}
