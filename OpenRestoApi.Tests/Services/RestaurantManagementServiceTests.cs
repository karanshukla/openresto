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
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsAll));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.GetByIdAsync(999));
    }

    [Fact]
    public async Task CreateAsync_HandlesNestedEntities()
    {
        using AppDbContext db = CreateDb(nameof(CreateAsync_HandlesNestedEntities));
        var svc = new RestaurantManagementService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            Sections = [new SectionDto { Name = "S1", Tables = [new TableDto { Name = "T1", Seats = 4 }] }]
        };
        RestaurantDto result = await svc.CreateAsync(dto);
        Assert.Single(result.Sections);
        Assert.Single(result.Sections[0].Tables);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateAsync(999, new UpdateRestaurantRequest()));
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_UpdatesFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
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
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_ReturnsNull_WhenRestaurantNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddSectionAsync(999, "S1"));
    }

    [Fact]
    public async Task UpdateSectionAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateSectionAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateSectionAsync(1, 1, "New"));
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteSectionAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteSectionAsync(1, 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsNull_WhenSectionNotFound()
    {
        using AppDbContext db = CreateDb(nameof(AddTableAsync_ReturnsNull_WhenSectionNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddTableAsync(1, 1, "T1", 4));
    }

    [Fact]
    public async Task UpdateTableAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateTableAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateTableAsync(1, 1, 1, "New", 2));
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteTableAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteTableAsync(1, 1, 1));
    }

    [Fact]
    public async Task GetAllAsync_ExcludesArchivedRestaurants()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ExcludesArchivedRestaurants));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Active" });
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
        Assert.Equal("Active", result[0].Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsDto_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Found", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);
        Assert.NotNull(result);
        Assert.Equal("Found", result.Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenArchived()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsNull_WhenArchived));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.GetByIdAsync(1));
    }

    [Fact]
    public async Task UpdateAsync_SplitsTags()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_SplitsTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "Italian, Pizza, Casual" });
        Assert.Equal(3, result!.Tags.Length);
        Assert.Contains("Italian", result.Tags);
    }

    [Fact]
    public async Task UpdateAsync_HandlesEmptyTags()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_HandlesEmptyTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Tags = "old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "" });
        Assert.Empty(result!.Tags);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsSection_WhenRestaurantExists()
    {
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_ReturnsSection_WhenRestaurantExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "Patio");
        Assert.NotNull(result);
        Assert.Equal("Patio", result.Name);
        Assert.Empty(result.Tables);
    }

    [Fact]
    public async Task UpdateSectionAsync_UpdatesName_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateSectionAsync_UpdatesName_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Old", RestaurantId = 1 });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.UpdateSectionAsync(1, 1, "New");
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = CreateDb(nameof(DeleteSectionAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        bool result = await svc.DeleteSectionAsync(1, 1);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableId);
        Assert.Null(booking.SectionId);
        Assert.False(await db.Sections.AnyAsync(s => s.Id == 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsTable_WhenSectionExists()
    {
        using AppDbContext db = CreateDb(nameof(AddTableAsync_ReturnsTable_WhenSectionExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        TableDto? result = await svc.AddTableAsync(1, 1, "T1", 4);
        Assert.NotNull(result);
        Assert.Equal("T1", result.Name);
        Assert.Equal(4, result.Seats);
    }

    [Fact]
    public async Task UpdateTableAsync_UpdatesNameAndSeats_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateTableAsync_UpdatesNameAndSeats_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "Old", Seats = 2, SectionId = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        TableDto? result = await svc.UpdateTableAsync(1, 1, 1, "New", 6);
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
        Assert.Equal(6, result.Seats);
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = CreateDb(nameof(DeleteTableAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        bool result = await svc.DeleteTableAsync(1, 1, 1);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableId);
        Assert.False(await db.Tables.AnyAsync(t => t.Id == 1));
    }
}
