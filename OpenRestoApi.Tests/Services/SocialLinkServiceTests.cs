using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class SocialLinkServiceTests
{
    [Fact]
    public async Task GetAllAsync_ReturnsEmpty_WhenNoSocialLinks()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_ReturnsEmpty_WhenNoSocialLinks));
        var svc = new SocialLinkService(new SocialLinkRepository(db));

        List<SocialLinkDto> result = await svc.GetAllAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsSortedBySortOrderThenId()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_ReturnsSortedBySortOrderThenId));
        db.SocialLinks.AddRange(
            new SocialLink { Label = "C", Url = "https://c.example.com", SortOrder = 2 },
            new SocialLink { Label = "A", Url = "https://a.example.com", SortOrder = 1 },
            new SocialLink { Label = "B", Url = "https://b.example.com", SortOrder = 1 }
        );
        await db.SaveChangesAsync();

        var svc = new SocialLinkService(new SocialLinkRepository(db));
        List<SocialLinkDto> result = await svc.GetAllAsync();

        Assert.Equal(3, result.Count);
        Assert.Equal("A", result[0].Label);
        Assert.Equal("B", result[1].Label);
        Assert.Equal("C", result[2].Label);
    }

    [Fact]
    public async Task GetAllAsync_MapsAllFields()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_MapsAllFields));
        db.SocialLinks.Add(new SocialLink
        {
            Label = "Instagram",
            Url = "https://instagram.com/resto",
            IconKey = "logo-instagram",
            SortOrder = 3,
        });
        await db.SaveChangesAsync();

        var svc = new SocialLinkService(new SocialLinkRepository(db));
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
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_PersistsAndReturnsDto));
        var svc = new SocialLinkService(new SocialLinkRepository(db));
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
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_ReturnsUpdatedDto_WhenFound));
        db.SocialLinks.Add(new SocialLink { Label = "Old", Url = "https://old.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(new SocialLinkRepository(db));
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
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new UpdateSocialLinkRequest { Label = "X", Url = "https://x.example.com", SortOrder = 0 };

        SocialLinkDto? result = await svc.UpdateAsync(9999, req);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsTrue_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteAsync_ReturnsTrue_WhenFound));
        db.SocialLinks.Add(new SocialLink { Label = "Del", Url = "https://del.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(new SocialLinkRepository(db));
        bool result = await svc.DeleteAsync(id);

        Assert.True(result);
        Assert.Equal(0, await db.SocialLinks.CountAsync());
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteAsync_ReturnsFalse_WhenNotFound));
        var svc = new SocialLinkService(new SocialLinkRepository(db));

        bool result = await svc.DeleteAsync(9999);

        Assert.False(result);
    }

    // ── Validation (CreateAsync) ────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_RejectsEmptyLabel(string? label)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateAsync_RejectsEmptyLabel)}_{label}");
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = label!,
            Url = "https://example.com",
            IconKey = "link-outline",
            SortOrder = 0,
        };

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("label cannot be empty", ex.Message);
        Assert.Equal(0, await db.SocialLinks.CountAsync());
    }

    [Fact]
    public async Task CreateAsync_RejectsOversizedLabel()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsOversizedLabel));
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = new string('A', 61),
            Url = "https://example.com",
            IconKey = "link-outline",
            SortOrder = 0,
        };

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("cannot exceed 60", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_RejectsEmptyUrl(string? url)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateAsync_RejectsEmptyUrl)}_{url}");
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = "Ok",
            Url = url!,
            IconKey = "link-outline",
            SortOrder = 0,
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
    }

    [Theory]
    [InlineData("asdf")]                    // bare string, not a URL
    [InlineData("javascript:alert(1)")]     // dangerous scheme
    [InlineData("/media/menu-1.pdf")]       // relative path (social links need absolute)
    [InlineData("ftp://example.com")]       // disallowed scheme
    public async Task CreateAsync_RejectsInvalidUrl(string url)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateAsync_RejectsInvalidUrl)}_{url}");
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = "Ok",
            Url = url,
            IconKey = "link-outline",
            SortOrder = 0,
        };

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("valid absolute URL", ex.Message);
    }

    [Theory]
    [InlineData("not-a-real-icon")]
    [InlineData("")]
    public async Task CreateAsync_RejectsUnknownIconKey(string iconKey)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateAsync_RejectsUnknownIconKey)}_{iconKey}");
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = "Ok",
            Url = "https://example.com",
            IconKey = iconKey,
            SortOrder = 0,
        };

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("Icon key", ex.Message);
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("mailto:hello@example.com")]
    [InlineData("tel:+15551234567")]
    [InlineData("sms:+15551234567")]
    public async Task CreateAsync_AcceptsValidUrlSchemes(string url)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(CreateAsync_AcceptsValidUrlSchemes)}_{url}");
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = "Ok",
            Url = url,
            IconKey = "link-outline",
            SortOrder = 0,
        };

        SocialLinkDto result = await svc.CreateAsync(req);

        Assert.Equal(url, result.Url);
    }

    [Fact]
    public async Task CreateAsync_TrimsLabelAndUrl()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_TrimsLabelAndUrl));
        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new CreateSocialLinkRequest
        {
            Label = "  Instagram  ",
            Url = "  https://instagram.com/resto  ",
            IconKey = "logo-instagram",
            SortOrder = 0,
        };

        SocialLinkDto result = await svc.CreateAsync(req);

        Assert.Equal("Instagram", result.Label);
        Assert.Equal("https://instagram.com/resto", result.Url);
    }

    // ── Validation (UpdateAsync) ────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_RejectsInvalidUrl()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_RejectsInvalidUrl));
        db.SocialLinks.Add(new SocialLink { Label = "Old", Url = "https://old.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new UpdateSocialLinkRequest
        {
            Label = "New",
            Url = "javascript:alert(1)",
            IconKey = "link-outline",
            SortOrder = 0,
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(id, req));

        // Entity is unchanged — the validation throws before any assignment.
        SocialLink stored = await db.SocialLinks.FirstAsync();
        Assert.Equal("https://old.example.com", stored.Url);
    }

    [Fact]
    public async Task UpdateAsync_RejectsUnknownIconKey()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_RejectsUnknownIconKey));
        db.SocialLinks.Add(new SocialLink { Label = "Old", Url = "https://old.example.com", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.SocialLinks.First().Id;

        var svc = new SocialLinkService(new SocialLinkRepository(db));
        var req = new UpdateSocialLinkRequest
        {
            Label = "New",
            Url = "https://new.example.com",
            IconKey = "not-a-real-icon",
            SortOrder = 0,
        };

        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(id, req));
    }
}
