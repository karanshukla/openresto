using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class RestaurantManagementServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAll()
    {
        using var db = CreateDb(nameof(GetAllAsync_ReturnsAll));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        var result = await svc.GetAllAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(GetByIdAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.GetByIdAsync(999));
    }

    [Fact]
    public async Task CreateAsync_HandlesNestedEntities()
    {
        using var db = CreateDb(nameof(CreateAsync_HandlesNestedEntities));
        var svc = new RestaurantManagementService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            Sections = [new SectionDto { Name = "S1", Tables = [new TableDto { Name = "T1", Seats = 4 }] }]
        };
        var result = await svc.CreateAsync(dto);
        Assert.Single(result.Sections);
        Assert.Single(result.Sections[0].Tables);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateAsync(999, new UpdateRestaurantRequest()));
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        using var db = CreateDb(nameof(UpdateAsync_UpdatesFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        var result = await svc.UpdateAsync(1, new UpdateRestaurantRequest 
        { 
            Name = "New", 
            OpenTime = "09:00", 
            CloseTime = "22:00", 
            OpenDays = "1,2,3", 
            Timezone = "GMT" 
        });
        Assert.Equal("New", result!.Name);
        Assert.Equal("GMT", result.Timezone);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using var db = CreateDb(nameof(AddSectionAsync_ReturnsNull_WhenRestaurantNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddSectionAsync(999, "S1"));
    }

    [Fact]
    public async Task UpdateSectionAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(UpdateSectionAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateSectionAsync(1, 1, "New"));
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsFalse_WhenNotFound()
    {
        using var db = CreateDb(nameof(DeleteSectionAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteSectionAsync(1, 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsNull_WhenSectionNotFound()
    {
        using var db = CreateDb(nameof(AddTableAsync_ReturnsNull_WhenSectionNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddTableAsync(1, 1, "T1", 4));
    }

    [Fact]
    public async Task UpdateTableAsync_ReturnsNull_WhenNotFound()
    {
        using var db = CreateDb(nameof(UpdateTableAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateTableAsync(1, 1, "New", 2));
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsFalse_WhenNotFound()
    {
        using var db = CreateDb(nameof(DeleteTableAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteTableAsync(1, 1));
    }
}
