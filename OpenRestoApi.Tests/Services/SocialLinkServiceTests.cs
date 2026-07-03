using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class SocialLinkServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEmpty_WhenNoSocialLinks()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsEmpty_WhenNoSocialLinks));
        var svc = new SocialLinkService(db);

        List<SocialLinkDto> result = await svc.GetAllAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsSortedBySortOrderThenId()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsSortedBySortOrderThenId));
        db.SocialLinks.AddRange(
            new SocialLink { Label = "C", Url = "https://c.example.com", SortOrder = 2 },
            new SocialLink { Label = "A", Url = "https://a.example.com", SortOrder = 1 },
            new SocialLink { Label = "B", Url = "https://b.example.com", SortOrder = 1 }
        );
        await db.SaveChangesAsync();

        var svc = new SocialLinkService(db);
        List<SocialLinkDto> result = await svc.GetAllAsync();

        Assert.Equal(3, result.Count);
        Assert.Equal("A", result[0].Label);
        Assert.Equal("B", result[1].Label);
        Assert.Equal("C", result[2].Label);
    }

    [Fact]
    public async Task GetAllAsync_MapsAllFields()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_MapsAllFields));
        db.SocialLinks.Add(new SocialLink
        {
            Label = "Instagram",
            Url = "https://instagram.com/resto",
            IconKey = "logo-instagram",
            SortOrder = 3,
        });
        await db.SaveChangesAsync();

        var svc = new SocialLinkService(db);
        List<SocialLinkDto> result = await svc.GetAllAsync();

        SocialLinkDto dto = Assert.Single(result);
        Assert.Equal("Instagram", dto.Label);
        Assert.Equal("https://instagram.com/resto", dto.Url);
        Assert.Equal("logo-instagram", dto.IconKey);
        Assert.Equal(3, dto.SortOrder);
        Assert.NotEqual(0, dto.Id);
    }

    [Fact]
    public async Task CreateAsync_PersistsAndReturnsDto()
    {
        using AppDbContext db = CreateDb(nameof(CreateAsync_PersistsAndReturnsDto));
        var svc = new SocialLinkService(db);
        var req = new CreateSocialLinkRequest
        {
            Label = "Yelp",
            Url = "https://yelp.com/biz/resto",
            IconKey = "star-outline",
            SortOrder = 0,
        };

        SocialLinkDto result = await svc.CreateAsync(req);

        Assert.NotEqual(0, result.Id);
        Assert.Equal("Yelp", result.Label);
        Assert.Equal("https://yelp.com/biz/resto", result.Url);
        Assert.Equal("star-outline", result.IconKey);
        Assert.Equal(1, await db.SocialLinks.CountAsync());
    }

    [Fact]
    public async Task UpdateAsync_ReturnsUpdatedDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsUpdatedDto_WhenFound));
        db.SocialLinks.Add(new SocialLink { Label = "Old", Url = "https://old.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(db);
        var req = new UpdateSocialLinkRequest
        {
            Label = "New",
            Url = "https://new.example.com",
            IconKey = "logo-facebook",
            SortOrder = 5,
        };

        SocialLinkDto? result = await svc.UpdateAsync(id, req);

        Assert.NotNull(result);
        Assert.Equal("New", result.Label);
        Assert.Equal("https://new.example.com", result.Url);
        Assert.Equal("logo-facebook", result.IconKey);
        Assert.Equal(5, result.SortOrder);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new SocialLinkService(db);
        var req = new UpdateSocialLinkRequest { Label = "X", Url = "https://x.example.com", SortOrder = 0 };

        SocialLinkDto? result = await svc.UpdateAsync(9999, req);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsTrue_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteAsync_ReturnsTrue_WhenFound));
        db.SocialLinks.Add(new SocialLink { Label = "Del", Url = "https://del.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(db);
        bool result = await svc.DeleteAsync(id);

        Assert.True(result);
        Assert.Equal(0, await db.SocialLinks.CountAsync());
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteAsync_ReturnsFalse_WhenNotFound));
        var svc = new SocialLinkService(db);

        bool result = await svc.DeleteAsync(9999);

        Assert.False(result);
    }
}
