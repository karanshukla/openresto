using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Controllers;

/// <summary>
/// HTTP-mapping tests for the combinable table-group CRUD endpoints (#271) and the two
/// delete-impact previews (#270), which the integration suite doesn't reach. The controller is a
/// thin mapper, so these pin the null → 404 / value → 200 contract each endpoint promises the admin
/// UI. <see cref="RestaurantManagementService"/> is concrete with non-virtual methods, so it is
/// composed over an in-memory database rather than mocked.
/// </summary>
public class RestaurantsControllerUnitTests
{
    private static RestaurantsController CreateController(AppDbContext db) => new(new RestaurantManagementService(
        new RestaurantRepository(db),
        new SectionRepository(db),
        new TableRepository(db),
        new BookingRepository(db),
        new TableGroupRepository(db)));

    /// <summary>Restaurant 1 / section 1 with two 4-seat tables (ids 1 and 2).</summary>
    private static void SeedRestaurant(AppDbContext db)
    {
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Groupable" });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.SaveChanges();
    }

    private static CreateTableGroupRequest CreateRequest(int combinedSeats = 7) =>
        new() { Name = "Window booths", Members = [1, 2], CombinedSeats = combinedSeats };

    // ── AddTableGroup ───────────────────────────────────────────────────────

    [Fact]
    public async Task AddTableGroup_ReturnsOk_WithTheCreatedGroup()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroup_ReturnsOk_WithTheCreatedGroup));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.AddTableGroup(1, CreateRequest());

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        TableGroupDto dto = Assert.IsType<TableGroupDto>(ok.Value);
        Assert.Equal("Window booths", dto.Name);
        Assert.Equal(7, dto.CombinedSeats);
        Assert.Equal(new[] { 1, 2 }, dto.Members.Select(m => m.Id));
    }

    [Fact]
    public async Task AddTableGroup_ReturnsNotFound_WhenRestaurantDoesNotExist()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroup_ReturnsNotFound_WhenRestaurantDoesNotExist));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.AddTableGroup(999, CreateRequest());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task AddTableGroup_PropagatesValidationException_ForAnInvalidMemberSet()
    {
        // GlobalExceptionHandler maps ValidationException to 400; the controller must not swallow it.
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroup_PropagatesValidationException_ForAnInvalidMemberSet));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        await Assert.ThrowsAsync<ValidationException>(() => controller.AddTableGroup(
            1, new CreateTableGroupRequest { Members = [1], CombinedSeats = 7 }));
    }

    // ── UpdateTableGroup ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateTableGroup_ReturnsOk_WithTheUpdatedGroup()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableGroup_ReturnsOk_WithTheUpdatedGroup));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);
        var created = Assert.IsType<TableGroupDto>(
            Assert.IsType<OkObjectResult>(await controller.AddTableGroup(1, CreateRequest())).Value);

        var result = await controller.UpdateTableGroup(1, created.Id, new UpdateTableGroupRequest
        {
            Name = "Renamed",
            Members = [1, 2],
            CombinedSeats = 8
        });

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        TableGroupDto dto = Assert.IsType<TableGroupDto>(ok.Value);
        Assert.Equal("Renamed", dto.Name);
        Assert.Equal(8, dto.CombinedSeats);
    }

    [Fact]
    public async Task UpdateTableGroup_ReturnsNotFound_WhenGroupDoesNotExist()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableGroup_ReturnsNotFound_WhenGroupDoesNotExist));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.UpdateTableGroup(1, 4242, new UpdateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 7
        });

        Assert.IsType<NotFoundResult>(result);
    }

    // ── DeleteTableGroup ────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteTableGroup_ReturnsNoContent_WhenRemoved()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableGroup_ReturnsNoContent_WhenRemoved));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);
        var created = Assert.IsType<TableGroupDto>(
            Assert.IsType<OkObjectResult>(await controller.AddTableGroup(1, CreateRequest())).Value);

        var result = await controller.DeleteTableGroup(1, created.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.TableGroups);
    }

    [Fact]
    public async Task DeleteTableGroup_ReturnsNotFound_WhenGroupDoesNotExist()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableGroup_ReturnsNotFound_WhenGroupDoesNotExist));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.DeleteTableGroup(1, 4242);

        Assert.IsType<NotFoundResult>(result);
    }

    // ── Delete-impact previews ──────────────────────────────────────────────

    [Fact]
    public async Task GetSectionDeleteImpact_ReturnsOk_WithTheAffectedBookingCount()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetSectionDeleteImpact_ReturnsOk_WithTheAffectedBookingCount));
        SeedRestaurant(db);
        DateTime future = DateTime.UtcNow.AddDays(3);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = future,
            BookingRef = "F1", EndTime = future.AddMinutes(60)
        });
        // A past booking is irrelevant to the decision and must not be counted.
        db.Bookings.Add(new Booking
        {
            Id = 2, RestaurantId = 1, SectionId = 1, TableId = 1, Date = DateTime.UtcNow.AddDays(-3),
            BookingRef = "P1", EndTime = DateTime.UtcNow.AddDays(-3).AddMinutes(60)
        });
        db.SaveChanges();
        RestaurantsController controller = CreateController(db);

        var result = await controller.GetSectionDeleteImpact(1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetSectionDeleteImpact_ReturnsNotFound_WhenSectionDoesNotBelongToTheRestaurant()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetSectionDeleteImpact_ReturnsNotFound_WhenSectionDoesNotBelongToTheRestaurant));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.GetSectionDeleteImpact(999, 1);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetTableDeleteImpact_ReturnsOk_WithTheAffectedBookingCount()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpact_ReturnsOk_WithTheAffectedBookingCount));
        SeedRestaurant(db);
        DateTime future = DateTime.UtcNow.AddDays(4);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, SectionId = 1, TableId = 1, Date = future,
            BookingRef = "F1", EndTime = future.AddMinutes(60)
        });
        db.SaveChanges();
        RestaurantsController controller = CreateController(db);

        var result = await controller.GetTableDeleteImpact(1, 1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetTableDeleteImpact_CountsBookingsHeldThroughACombinableGroup()
    {
        // A group booking stores TableId = null, so a table-only count would report zero and the
        // confirm step would claim the delete orphans nothing while a merged-table party is booked.
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpact_CountsBookingsHeldThroughACombinableGroup));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);
        var created = Assert.IsType<TableGroupDto>(
            Assert.IsType<OkObjectResult>(await controller.AddTableGroup(1, CreateRequest())).Value);

        DateTime future = DateTime.UtcNow.AddDays(5);
        db.Bookings.Add(new Booking
        {
            Id = 1, RestaurantId = 1, SectionId = 1, TableId = null, TableGroupId = created.Id,
            Date = future, BookingRef = "G1", EndTime = future.AddMinutes(60)
        });
        db.SaveChanges();

        var result = await controller.GetTableDeleteImpact(1, 1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetTableDeleteImpact_ReturnsNotFound_WhenTableDoesNotExist()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpact_ReturnsNotFound_WhenTableDoesNotExist));
        SeedRestaurant(db);
        RestaurantsController controller = CreateController(db);

        var result = await controller.GetTableDeleteImpact(1, 1, 4242);

        Assert.IsType<NotFoundResult>(result);
    }
}
