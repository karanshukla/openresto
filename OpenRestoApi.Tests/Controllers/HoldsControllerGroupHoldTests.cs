using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Controllers;

/// <summary>
/// Covers the combinable-table group hold path (#272) and the auto-assign path of
/// <see cref="HoldsController.PlaceHold"/>. The single-table path lives in
/// <see cref="HoldsControllerUnitTests"/>.
/// </summary>
public class HoldsControllerGroupHoldTests
{
    private readonly Mock<IHoldService> _mockHoldService = new();
    private readonly Mock<IHoldPolicyService> _mockPolicy = new();
    private readonly Mock<IBookingRepository> _mockBookingRepository = new();
    private readonly Mock<ITableGroupRepository> _mockTableGroupRepository = new();
    private readonly HoldsController _controller;

    public HoldsControllerGroupHoldTests()
    {
        // TableAutoAssigner is sealed, so it is composed from mocked dependencies rather than mocked.
        TableAutoAssigner autoAssigner = new(_mockBookingRepository.Object, _mockHoldService.Object);
        _controller = new HoldsController(
            _mockHoldService.Object, _mockPolicy.Object, autoAssigner, _mockTableGroupRepository.Object);
    }

    private static readonly DateTime BookingDate = DateTime.UtcNow.Date.AddDays(1).AddHours(19);

    private static PlaceHoldRequest GroupRequest(int seats = 6, int groupId = 10) => new()
    {
        RestaurantId = 1,
        TableGroupId = groupId,
        Seats = seats,
        Date = BookingDate
    };

    private static TableGroup GroupWithMembers(int combinedSeats = 8, params (int TableId, int SectionId)[] members)
    {
        var group = new TableGroup { Id = 10, RestaurantId = 1, CombinedSeats = combinedSeats };
        foreach ((int tableId, int sectionId) in members)
        {
            group.Members.Add(new TableGroupMembership
            {
                TableGroupId = group.Id,
                TableId = tableId,
                Table = new Table { Id = tableId, SectionId = sectionId, Seats = 4 }
            });
        }
        return group;
    }

    private void SetupEligiblePolicy(Restaurant? restaurant = null)
        => _mockPolicy.Setup(p => p.ValidateAnyTableAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Eligible(
                restaurant ?? new Restaurant { Id = 1, DefaultBookingDurationMinutes = 90 }, BookingDate));

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenBothTableIdAndTableGroupIdProvided()
    {
        PlaceHoldRequest request = GroupRequest();
        request.TableId = 5;

        var result = await _controller.PlaceHold(request);

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(bad.Value);
        Assert.Equal("Specify either TableId or TableGroupId, not both.", msg.Message);
        _mockPolicy.Verify(p => p.ValidateAnyTableAsync(It.IsAny<int>(), It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsNotFound_WhenRestaurantMissing()
    {
        _mockPolicy.Setup(p => p.ValidateAnyTableAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.NotFound());

        var result = await _controller.PlaceHold(GroupRequest());

        NotFoundObjectResult notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("Restaurant not found.", Assert.IsType<MessageResponse>(notFound.Value).Message);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsBadRequest_WhenPolicyRejects()
    {
        _mockPolicy.Setup(p => p.ValidateAnyTableAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Rejected("The restaurant is closed at the requested time."));

        var result = await _controller.PlaceHold(GroupRequest());

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("The restaurant is closed at the requested time.",
            Assert.IsType<MessageResponse>(bad.Value).Message);
        _mockTableGroupRepository.Verify(
            r => r.GetByIdWithMembersAsync(It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsConflict_WhenPolicyReportsExistingBooking()
    {
        _mockPolicy.Setup(p => p.ValidateAnyTableAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Booked("This table is already booked for that time."));

        var result = await _controller.PlaceHold(GroupRequest());

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("This table is already booked for that time.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsNotFound_WhenGroupDoesNotExist()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1)).ReturnsAsync((TableGroup?)null);

        var result = await _controller.PlaceHold(GroupRequest());

        NotFoundObjectResult notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("Table group not found.", Assert.IsType<MessageResponse>(notFound.Value).Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task PlaceGroupHold_ReturnsBadRequest_WhenSeatsNotPositive(int seats)
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));

        var result = await _controller.PlaceHold(GroupRequest(seats));

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Seats is required for a group hold",
            Assert.IsType<MessageResponse>(bad.Value).Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsConflict_WhenPartyExceedsCombinedSeats()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));

        var result = await _controller.PlaceHold(GroupRequest(seats: 9));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("This group only has 8 combined seats, but 9 guests were requested.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
        _mockHoldService.Verify(
            s => s.PlaceGroupHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsConflict_WhenGroupIsTooLargeForTheOversizeCap()
    {
        SetupEligiblePolicy(new Restaurant { Id = 1, DefaultBookingDurationMinutes = 90, MaxTableOversizeSeats = 2 });
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));

        var result = await _controller.PlaceHold(GroupRequest(seats: 5));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("This group has 8 combined seats, which is too large for a party of 5.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    [Fact]
    public async Task PlaceGroupHold_AllowsGroup_WhenOversizeCapIsSatisfied()
    {
        SetupEligiblePolicy(new Restaurant { Id = 1, DefaultBookingDurationMinutes = 90, MaxTableOversizeSeats = 3 });
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));
        _mockHoldService.Setup(s => s.PlaceGroupHold(1, 10, It.IsAny<IReadOnlyList<int>>(), 1, BookingDate, null, 90))
            .Returns(new HoldResult("group-hold-1", BookingDate.AddMinutes(5)));

        var result = await _controller.PlaceHold(GroupRequest(seats: 5));

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsConflict_WhenGroupHasNoMembers()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8));

        var result = await _controller.PlaceHold(GroupRequest(seats: 6));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("This table group has no members.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsConflict_WhenAMemberIsAlreadyHeld()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));
        _mockHoldService.Setup(s => s.PlaceGroupHold(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns((HoldResult?)null);

        var result = await _controller.PlaceHold(GroupRequest(seats: 6));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("One of the combined tables is already held by another user. Please try again shortly.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    [Fact]
    public async Task PlaceGroupHold_ReturnsOk_WithGroupIdAndMembersResolvedFromThePersistedGroup()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (9, 3), (4, 2)));

        DateTime expiry = BookingDate.AddMinutes(5);
        IReadOnlyList<int>? capturedMembers = null;
        int capturedSectionId = -1;
        _mockHoldService.Setup(s => s.PlaceGroupHold(
                1, 10, It.IsAny<IReadOnlyList<int>>(), It.IsAny<int>(), BookingDate, It.IsAny<string?>(), 90))
            .Callback<int, int, IReadOnlyList<int>, int, DateTime, string?, int>(
                (_, _, members, sectionId, _, _, _) => { capturedMembers = members; capturedSectionId = sectionId; })
            .Returns(new HoldResult("group-hold-1", expiry));

        var result = await _controller.PlaceHold(GroupRequest(seats: 6));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        HoldResponse response = Assert.IsType<HoldResponse>(ok.Value);
        Assert.Equal("group-hold-1", response.HoldId);
        Assert.Equal(expiry, response.ExpiresAt);
        Assert.Equal(10, response.TableGroupId);
        // A group hold reserves the group, not one table, so the single-table fields stay null.
        Assert.Null(response.TableId);
        Assert.Null(response.SectionId);
        Assert.Equal(new[] { 9, 4 }, capturedMembers);
        // Section comes from the lowest-numbered member table (4 → section 2), not from request order.
        Assert.Equal(2, capturedSectionId);
    }

    [Fact]
    public async Task PlaceGroupHold_FallsBackToSectionZero_WhenTheLowestMemberHasNoLoadedTable()
    {
        SetupEligiblePolicy();
        var group = new TableGroup { Id = 10, RestaurantId = 1, CombinedSeats = 8 };
        group.Members.Add(new TableGroupMembership { TableGroupId = 10, TableId = 4, Table = null });
        group.Members.Add(new TableGroupMembership
        {
            TableGroupId = 10,
            TableId = 9,
            Table = new Table { Id = 9, SectionId = 3, Seats = 4 }
        });
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1)).ReturnsAsync(group);

        int capturedSectionId = -1;
        _mockHoldService.Setup(s => s.PlaceGroupHold(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Callback<int, int, IReadOnlyList<int>, int, DateTime, string?, int>(
                (_, _, _, sectionId, _, _, _) => capturedSectionId = sectionId)
            .Returns(new HoldResult("group-hold-1", BookingDate.AddMinutes(5)));

        var result = await _controller.PlaceHold(GroupRequest(seats: 6));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, capturedSectionId);
    }

    [Fact]
    public async Task PlaceGroupHold_ForwardsCurrentHoldId_SoTheCallersOwnHoldIsReplacedNotBlocking()
    {
        SetupEligiblePolicy();
        _mockTableGroupRepository.Setup(r => r.GetByIdWithMembersAsync(10, 1))
            .ReturnsAsync(GroupWithMembers(8, (1, 1), (2, 1)));
        _mockHoldService.Setup(s => s.PlaceGroupHold(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns(new HoldResult("group-hold-2", BookingDate.AddMinutes(5)));

        PlaceHoldRequest request = GroupRequest(seats: 6);
        request.CurrentHoldId = "previous-hold";

        var result = await _controller.PlaceHold(request);

        Assert.IsType<OkObjectResult>(result);
        _mockHoldService.Verify(s => s.PlaceGroupHold(
            1, 10, It.IsAny<IReadOnlyList<int>>(), 1, BookingDate, "previous-hold", 90), Times.Once);
    }

    // ── Auto-assign path ────────────────────────────────────────────────────

    private static PlaceHoldRequest AutoAssignRequest(int seats = 2) => new()
    {
        RestaurantId = 1,
        Seats = seats,
        Date = BookingDate
    };

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task PlaceAutoAssignedHold_ReturnsBadRequest_WhenSeatsNotPositive(int seats)
    {
        SetupEligiblePolicy();

        var result = await _controller.PlaceHold(AutoAssignRequest(seats));

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Seats is required for auto-assign",
            Assert.IsType<MessageResponse>(bad.Value).Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PlaceAutoAssignedHold_ReturnsConflict_WhenNoTableFitsTheParty()
    {
        // A restaurant with no sections yields no candidates at all.
        SetupEligiblePolicy(new Restaurant { Id = 1, DefaultBookingDurationMinutes = 60 });

        var result = await _controller.PlaceHold(AutoAssignRequest(seats: 4));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("No tables are available for the requested time and party size.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    private static Restaurant RestaurantWithOneTable(int seats = 4) => new()
    {
        Id = 1,
        DefaultBookingDurationMinutes = 60,
        Sections =
        [
            new Section
            {
                Id = 1,
                Tables = [new Table { Id = 7, SectionId = 1, Seats = seats }]
            }
        ]
    };

    [Fact]
    public async Task PlaceAutoAssignedHold_ReturnsConflict_WhenEveryCandidateIsHeldByAnotherUser()
    {
        SetupEligiblePolicy(RestaurantWithOneTable());
        _mockHoldService.Setup(s => s.PlaceAutoHold(
                It.IsAny<int>(), It.IsAny<IReadOnlyList<TableCandidate>>(),
                It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns((AutoAssignResult?)null);

        var result = await _controller.PlaceHold(AutoAssignRequest(seats: 4));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("All suitable tables are currently being held by other users. Please try again shortly.",
            Assert.IsType<MessageResponse>(conflict.Value).Message);
    }

    [Fact]
    public async Task PlaceAutoAssignedHold_ReturnsOk_WithTheResolvedTableAndSection()
    {
        SetupEligiblePolicy(RestaurantWithOneTable());
        DateTime expiry = BookingDate.AddMinutes(5);
        _mockHoldService.Setup(s => s.PlaceAutoHold(
                1, It.IsAny<IReadOnlyList<TableCandidate>>(), BookingDate, It.IsAny<string?>(), 60))
            .Returns(new AutoAssignResult("auto-hold-1", expiry, TableId: 7, SectionId: 1));

        var result = await _controller.PlaceHold(AutoAssignRequest(seats: 4));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        HoldResponse response = Assert.IsType<HoldResponse>(ok.Value);
        Assert.Equal("auto-hold-1", response.HoldId);
        Assert.Equal(expiry, response.ExpiresAt);
        Assert.Equal(7, response.TableId);
        Assert.Equal(1, response.SectionId);
    }
}
