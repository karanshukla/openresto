using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Controllers;

/// <summary>
/// HTTP-mapping tests for the combinable table-group CRUD endpoints (#271) and the two
/// delete-impact previews (#270), which the integration suite doesn't reach. The controller is a
/// thin mapper, so these pin the null → 404 / value → 200 contract each endpoint promises the admin
/// UI. <see cref="RestaurantManagementService"/> is concrete with non-virtual methods, so it is
/// composed over mocked repository interfaces — the concrete repositories are internal and gated by
/// <c>[OnlyAccessibleBy]</c>, and controller mapping doesn't need real persistence anyway.
/// </summary>
public class RestaurantsControllerUnitTests
{
    private readonly Mock<IRestaurantRepository> _restaurants = new();
    private readonly Mock<ISectionRepository> _sections = new();
    private readonly Mock<ITableRepository> _tables = new();
    private readonly Mock<IBookingRepository> _bookings = new();
    private readonly Mock<ITableGroupRepository> _groups = new();
    private readonly RestaurantsController _controller;

    public RestaurantsControllerUnitTests()
    {
        _groups.Setup(g => g.AddAsync(It.IsAny<TableGroup>())).Returns(Task.CompletedTask);
        _groups.Setup(g => g.SaveChangesAsync()).Returns(Task.CompletedTask);

        _controller = new RestaurantsController(new RestaurantManagementService(
            _restaurants.Object, _sections.Object, _tables.Object, _bookings.Object, _groups.Object));
    }

    private static Table TableOf(int id, int seats = 4, int sectionId = 1) =>
        new() { Id = id, Name = $"T{id}", Seats = seats, SectionId = sectionId };

    /// <summary>Restaurant 1 exists and owns two 4-seat tables (ids 1 and 2), with no groups yet.</summary>
    private void SeedRestaurantWithTwoTables()
    {
        _restaurants.Setup(r => r.ExistsAsync(1)).ReturnsAsync(true);
        _tables.Setup(t => t.GetManyForRestaurantAsync(It.IsAny<IReadOnlyList<int>>(), 1))
            .ReturnsAsync((IReadOnlyList<int> ids, int _) => ids.Select(id => TableOf(id)).ToList());
        _groups.Setup(g => g.GetAllWithMembersByRestaurantAsync(1)).ReturnsAsync([]);
    }

    private static TableGroup GroupOf(int id = 3, int combinedSeats = 7, params int[] memberIds)
    {
        var group = new TableGroup { Id = id, Name = "Window booths", RestaurantId = 1, CombinedSeats = combinedSeats };
        foreach (int memberId in memberIds)
        {
            group.Members.Add(new TableGroupMembership
            {
                TableGroupId = id,
                TableId = memberId,
                Table = TableOf(memberId)
            });
        }
        return group;
    }

    private static CreateTableGroupRequest CreateRequest(int combinedSeats = 7) =>
        new() { Name = "Window booths", Members = [1, 2], CombinedSeats = combinedSeats };

    // ── AddTableGroup ───────────────────────────────────────────────────────

    [Fact]
    public async Task AddTableGroup_ReturnsOk_WithTheCreatedGroup()
    {
        SeedRestaurantWithTwoTables();

        var result = await _controller.AddTableGroup(1, CreateRequest());

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        TableGroupDto dto = Assert.IsType<TableGroupDto>(ok.Value);
        Assert.Equal("Window booths", dto.Name);
        Assert.Equal(7, dto.CombinedSeats);
        Assert.Equal([1, 2], dto.Members.Select(m => m.Id));
        _groups.Verify(g => g.AddAsync(It.Is<TableGroup>(x => x.CombinedSeats == 7)), Times.Once);
        _groups.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task AddTableGroup_ReturnsNotFound_WhenRestaurantDoesNotExist()
    {
        _restaurants.Setup(r => r.ExistsAsync(999)).ReturnsAsync(false);

        var result = await _controller.AddTableGroup(999, CreateRequest());

        Assert.IsType<NotFoundResult>(result);
        _groups.Verify(g => g.AddAsync(It.IsAny<TableGroup>()), Times.Never);
    }

    [Fact]
    public async Task AddTableGroup_PropagatesValidationException_ForAnInvalidMemberSet()
    {
        // GlobalExceptionHandler maps ValidationException to 400; the controller must not swallow it.
        SeedRestaurantWithTwoTables();

        await Assert.ThrowsAsync<ValidationException>(() => _controller.AddTableGroup(
            1, new CreateTableGroupRequest { Members = [1], CombinedSeats = 7 }));
    }

    [Fact]
    public async Task AddTableGroup_PropagatesValidationException_WhenCombinedSeatsExceedsTheMemberSum()
    {
        SeedRestaurantWithTwoTables();

        await Assert.ThrowsAsync<ValidationException>(() => _controller.AddTableGroup(1, CreateRequest(combinedSeats: 9)));
    }

    // ── UpdateTableGroup ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateTableGroup_ReturnsOk_WithTheUpdatedGroup()
    {
        SeedRestaurantWithTwoTables();
        TableGroup existing = GroupOf(memberIds: [1, 2]);
        _groups.Setup(g => g.GetByIdWithMembersAsync(3, 1)).ReturnsAsync(existing);

        var result = await _controller.UpdateTableGroup(1, 3, new UpdateTableGroupRequest
        {
            Name = "Renamed",
            Members = [1, 2],
            CombinedSeats = 8
        });

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        TableGroupDto dto = Assert.IsType<TableGroupDto>(ok.Value);
        Assert.Equal("Renamed", dto.Name);
        Assert.Equal(8, dto.CombinedSeats);
        _groups.Verify(g => g.SaveChangesAsync(), Times.Once);
    }

    [Fact]
    public async Task UpdateTableGroup_ReturnsNotFound_WhenGroupDoesNotExist()
    {
        _groups.Setup(g => g.GetByIdWithMembersAsync(4242, 1)).ReturnsAsync((TableGroup?)null);

        var result = await _controller.UpdateTableGroup(1, 4242, new UpdateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 7
        });

        Assert.IsType<NotFoundResult>(result);
        _groups.Verify(g => g.SaveChangesAsync(), Times.Never);
    }

    // ── DeleteTableGroup ────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteTableGroup_ReturnsNoContent_AndClearsTheGroupReferenceOnItsBookings()
    {
        TableGroup group = GroupOf(memberIds: [1, 2]);
        _groups.Setup(g => g.GetByIdWithMembersAsync(3, 1)).ReturnsAsync(group);
        var booking = new Booking { Id = 1, RestaurantId = 1, TableGroupId = 3, BookingRef = "G1" };
        _bookings.Setup(b => b.GetByTableGroupAsync(3)).ReturnsAsync([booking]);

        var result = await _controller.DeleteTableGroup(1, 3);

        Assert.IsType<NoContentResult>(result);
        // The booking survives the delete; only its group reference is cleared.
        Assert.Null(booking.TableGroupId);
        _groups.Verify(g => g.Remove(group), Times.Once);
    }

    [Fact]
    public async Task DeleteTableGroup_ReturnsNotFound_WhenGroupDoesNotExist()
    {
        _groups.Setup(g => g.GetByIdWithMembersAsync(4242, 1)).ReturnsAsync((TableGroup?)null);

        var result = await _controller.DeleteTableGroup(1, 4242);

        Assert.IsType<NotFoundResult>(result);
        _groups.Verify(g => g.Remove(It.IsAny<TableGroup>()), Times.Never);
    }

    // ── Delete-impact previews ──────────────────────────────────────────────

    [Fact]
    public async Task GetSectionDeleteImpact_ReturnsOk_WithTheAffectedBookingCount()
    {
        _sections.Setup(s => s.GetWithTablesForRestaurantAsync(1, 1))
            .ReturnsAsync(new Section { Id = 1, Name = "Main", RestaurantId = 1, Tables = [TableOf(1), TableOf(2)] });
        _bookings.Setup(b => b.CountFutureBySectionOrTablesAsync(1, It.IsAny<IReadOnlyList<int>>(), It.IsAny<DateTime>()))
            .ReturnsAsync(3);
        _groups.Setup(g => g.GetAllWithMembersByRestaurantAsync(1)).ReturnsAsync([]);

        var result = await _controller.GetSectionDeleteImpact(1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(3, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetSectionDeleteImpact_ReturnsNotFound_WhenSectionDoesNotBelongToTheRestaurant()
    {
        _sections.Setup(s => s.GetWithTablesForRestaurantAsync(1, 999)).ReturnsAsync((Section?)null);

        var result = await _controller.GetSectionDeleteImpact(999, 1);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetTableDeleteImpact_ReturnsOk_WithTheAffectedBookingCount()
    {
        _tables.Setup(t => t.GetForRestaurantAsync(1, 1, 1)).ReturnsAsync(TableOf(1));
        _bookings.Setup(b => b.CountFutureByTableAsync(1, It.IsAny<DateTime>())).ReturnsAsync(2);
        _groups.Setup(g => g.GetAllWithMembersByRestaurantAsync(1)).ReturnsAsync([]);

        var result = await _controller.GetTableDeleteImpact(1, 1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetTableDeleteImpact_AlsoCountsBookingsHeldThroughACombinableGroup()
    {
        // A group booking stores TableId = null, so a table-only count reports zero and the confirm
        // step would claim the delete orphans nothing while a merged-table party is booked.
        _tables.Setup(t => t.GetForRestaurantAsync(1, 1, 1)).ReturnsAsync(TableOf(1));
        _bookings.Setup(b => b.CountFutureByTableAsync(1, It.IsAny<DateTime>())).ReturnsAsync(0);
        _groups.Setup(g => g.GetAllWithMembersByRestaurantAsync(1)).ReturnsAsync([GroupOf(memberIds: [1, 2])]);
        _bookings.Setup(b => b.CountFutureByTableGroupsAsync(
                It.Is<IReadOnlyList<int>>(ids => ids.Contains(3)), It.IsAny<DateTime>()))
            .ReturnsAsync(1);

        var result = await _controller.GetTableDeleteImpact(1, 1, 1);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, Assert.IsType<DeleteImpactDto>(ok.Value).Bookings);
    }

    [Fact]
    public async Task GetTableDeleteImpact_SkipsTheGroupQuery_WhenNoGroupCoversTheTable()
    {
        _tables.Setup(t => t.GetForRestaurantAsync(1, 1, 1)).ReturnsAsync(TableOf(1));
        _bookings.Setup(b => b.CountFutureByTableAsync(1, It.IsAny<DateTime>())).ReturnsAsync(4);
        _groups.Setup(g => g.GetAllWithMembersByRestaurantAsync(1)).ReturnsAsync([GroupOf(memberIds: [7, 8])]);

        var result = await _controller.GetTableDeleteImpact(1, 1, 1);

        Assert.Equal(4, Assert.IsType<DeleteImpactDto>(Assert.IsType<OkObjectResult>(result).Value).Bookings);
        _bookings.Verify(
            b => b.CountFutureByTableGroupsAsync(It.IsAny<IReadOnlyList<int>>(), It.IsAny<DateTime>()),
            Times.Never);
    }

    [Fact]
    public async Task GetTableDeleteImpact_ReturnsNotFound_WhenTableDoesNotExist()
    {
        _tables.Setup(t => t.GetForRestaurantAsync(4242, 1, 1)).ReturnsAsync((Table?)null);

        var result = await _controller.GetTableDeleteImpact(1, 1, 4242);

        Assert.IsType<NotFoundResult>(result);
    }
}
