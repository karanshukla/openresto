using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Controllers;

public class HoldsControllerUnitTests
{
    private readonly Mock<IHoldService> _mockHoldService;
    private readonly Mock<IHoldPolicyService> _mockPolicy;
    private readonly HoldsController _controller;

    public HoldsControllerUnitTests()
    {
        _mockHoldService = new Mock<IHoldService>();
        _mockPolicy = new Mock<IHoldPolicyService>();
        // TableAutoAssigner is sealed, so we instantiate it directly. The explicit-table path
        // under test never invokes it; the auto-assign tests below substitute via the policy mock.
        TableAutoAssigner autoAssigner = new(new Mock<IBookingRepository>().Object);
        _controller = new HoldsController(_mockHoldService.Object, _mockPolicy.Object, autoAssigner);
    }

    private static PlaceHoldRequest ExplicitRequest(DateTime date) => new()
    {
        RestaurantId = 1,
        TableId = 1,
        SectionId = 1,
        Date = date
    };

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("Error", "Message");
        var result = await _controller.PlaceHold(ExplicitRequest(DateTime.UtcNow.AddDays(1)));
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenOnlyOneOfTableOrSectionProvided()
    {
        var result = await _controller.PlaceHold(new PlaceHoldRequest
        {
            RestaurantId = 1,
            TableId = 1,
            // SectionId omitted
            Date = DateTime.UtcNow.AddDays(1)
        });

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(bad.Value);
        Assert.Contains("Specify both TableId and SectionId", msg.Message);
    }

    [Fact]
    public async Task PlaceHold_ReturnsNotFound_WhenPolicyReturnsNotFound()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.NotFound());

        var result = await _controller.PlaceHold(ExplicitRequest(DateTime.UtcNow.AddDays(1)));

        NotFoundObjectResult notFound = Assert.IsType<NotFoundObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(notFound.Value);
        Assert.Equal("Restaurant not found.", msg.Message);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenPolicyRejects()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Rejected("no."));

        var result = await _controller.PlaceHold(ExplicitRequest(DateTime.UtcNow.AddDays(1)));

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(bad.Value);
        Assert.Equal("no.", msg.Message);
    }

    [Fact]
    public async Task PlaceHold_ReturnsConflict_WhenPolicyReportsExistingBooking()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Booked("taken."));

        var result = await _controller.PlaceHold(ExplicitRequest(DateTime.UtcNow.AddDays(1)));

        ConflictObjectResult conflict = Assert.IsType<ConflictObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(conflict.Value);
        Assert.Equal("taken.", msg.Message);
        // HoldService must not be touched when policy already rejected.
        _mockHoldService.Verify(
            s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task PlaceHold_ReturnsConflict_WhenEligibleButAlreadyHeld()
    {
        var restaurant = new Restaurant { Id = 1, DefaultBookingDurationMinutes = 60 };
        var date = DateTime.UtcNow.AddDays(1);
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Eligible(restaurant, date));
        _mockHoldService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns((HoldResult?)null);

        var result = await _controller.PlaceHold(ExplicitRequest(date));

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_ReturnsOk_AndPassesPolicyBookingDate_WhenEligibleAndAcquired()
    {
        var restaurant = new Restaurant { Id = 1, DefaultBookingDurationMinutes = 75 };
        // Policy-normalized date differs from the raw request date — controller must use the normalized one.
        var normalizedDate = DateTime.UtcNow.Date.AddDays(2).AddHours(12);
        var rawDate = DateTime.SpecifyKind(normalizedDate, DateTimeKind.Unspecified);

        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), rawDate))
            .ReturnsAsync(HoldPolicyResult.Eligible(restaurant, normalizedDate));
        _mockHoldService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), normalizedDate, It.IsAny<string?>(), 75))
            .Returns(new HoldResult("hold-1", DateTime.UtcNow.AddMinutes(5)));

        var result = await _controller.PlaceHold(ExplicitRequest(rawDate));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        HoldResponse response = Assert.IsType<HoldResponse>(ok.Value);
        Assert.Equal("hold-1", response.HoldId);
        _mockHoldService.Verify(
            s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), normalizedDate, It.IsAny<string?>(), 75),
            Times.Once);
    }

    [Fact]
    public void ReleaseHold_DelegatesToService_AndReturnsNoContent()
    {
        var result = _controller.ReleaseHold("hold-1");

        Assert.IsType<NoContentResult>(result);
        _mockHoldService.Verify(s => s.ReleaseHold("hold-1"), Times.Once);
    }
}
