using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class HighlightServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEmpty_WhenNoHighlights()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsEmpty_WhenNoHighlights));
        var svc = new HighlightService(new HighlightRepository(db));

        List<HighlightDto> result = await svc.GetAllAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsSortedBySortOrderThenId()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsSortedBySortOrderThenId));
        db.Highlights.AddRange(
            new RestaurantHighlight { Title = "C", Body = "b", SortOrder = 2 },
            new RestaurantHighlight { Title = "A", Body = "b", SortOrder = 1 },
            new RestaurantHighlight { Title = "B", Body = "b", SortOrder = 1 }
        );
        await db.SaveChangesAsync();

        var svc = new HighlightService(new HighlightRepository(db));
        List<HighlightDto> result = await svc.GetAllAsync();

        Assert.Equal(3, result.Count);
        Assert.Equal("A", result[0].Title);
        Assert.Equal("B", result[1].Title);
        Assert.Equal("C", result[2].Title);
    }

    [Fact]
    public async Task GetAllAsync_MapsAllFields()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_MapsAllFields));
        db.Highlights.Add(new RestaurantHighlight { Title = "T", Body = "B", IconKey = "flame", SortOrder = 3 });
        await db.SaveChangesAsync();

        var svc = new HighlightService(new HighlightRepository(db));
        List<HighlightDto> result = await svc.GetAllAsync();

        HighlightDto dto = Assert.Single(result);
        Assert.Equal("T", dto.Title);
        Assert.Equal("B", dto.Body);
        Assert.Equal("flame", dto.IconKey);
        Assert.Equal(3, dto.SortOrder);
        Assert.NotEqual(0, dto.Id);
    }

    [Fact]
    public async Task CreateAsync_PersistsAndReturnsDto()
    {
        using AppDbContext db = CreateDb(nameof(CreateAsync_PersistsAndReturnsDto));
        var svc = new HighlightService(new HighlightRepository(db));
        var req = new CreateHighlightRequest { Title = "Test", Body = "body", IconKey = "star", SortOrder = 0 };

        HighlightDto result = await svc.CreateAsync(req);

        Assert.NotEqual(0, result.Id);
        Assert.Equal("Test", result.Title);
        Assert.Equal("body", result.Body);
        Assert.Equal("star", result.IconKey);
        Assert.Equal(1, await db.Highlights.CountAsync());
    }

    [Fact]
    public async Task UpdateAsync_ReturnsUpdatedDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsUpdatedDto_WhenFound));
        db.Highlights.Add(new RestaurantHighlight { Title = "Old", Body = "old body", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.Highlights.First().Id;

        var svc = new HighlightService(new HighlightRepository(db));
        var req = new UpdateHighlightRequest { Title = "New", Body = "new body", IconKey = "flame", SortOrder = 5 };

        HighlightDto? result = await svc.UpdateAsync(id, req);

        Assert.NotNull(result);
        Assert.Equal("New", result.Title);
        Assert.Equal("new body", result.Body);
        Assert.Equal("flame", result.IconKey);
        Assert.Equal(5, result.SortOrder);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new HighlightService(new HighlightRepository(db));
        var req = new UpdateHighlightRequest { Title = "X", Body = "y", SortOrder = 0 };

        HighlightDto? result = await svc.UpdateAsync(9999, req);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_ReturnsTrue_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteAsync_ReturnsTrue_WhenFound));
        db.Highlights.Add(new RestaurantHighlight { Title = "Del", Body = "body", SortOrder = 0 });
        await db.SaveChangesAsync();
        int id = db.Highlights.First().Id;

        var svc = new HighlightService(new HighlightRepository(db));
        bool result = await svc.DeleteAsync(id);

        Assert.True(result);
        Assert.Equal(0, await db.Highlights.CountAsync());
    }

    [Fact]
    public async Task DeleteAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteAsync_ReturnsFalse_WhenNotFound));
        var svc = new HighlightService(new HighlightRepository(db));

        bool result = await svc.DeleteAsync(9999);

        Assert.False(result);
    }
}
