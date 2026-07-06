using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
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
        _controller = new HoldsController(_mockHoldService.Object, _mockPolicy.Object);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("Error", "Message");
        var result = await _controller.PlaceHold(new PlaceHoldRequest());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_ReturnsNotFound_WhenPolicyReturnsNotFound()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.NotFound());

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = DateTime.UtcNow.AddDays(1) });

        NotFoundObjectResult notFound = Assert.IsType<NotFoundObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(notFound.Value);
        Assert.Equal("Restaurant not found.", msg.Message);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenPolicyRejects()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Rejected("no."));

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = DateTime.UtcNow.AddDays(1) });

        BadRequestObjectResult bad = Assert.IsType<BadRequestObjectResult>(result);
        MessageResponse msg = Assert.IsType<MessageResponse>(bad.Value);
        Assert.Equal("no.", msg.Message);
    }

    [Fact]
    public async Task PlaceHold_ReturnsConflict_WhenPolicyReportsExistingBooking()
    {
        _mockPolicy.Setup(p => p.ValidateAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(HoldPolicyResult.Booked("taken."));

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = DateTime.UtcNow.AddDays(1) });

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

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = date });

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

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = rawDate });

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
