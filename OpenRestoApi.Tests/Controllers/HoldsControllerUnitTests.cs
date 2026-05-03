using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using Xunit;

namespace OpenRestoApi.Tests.Controllers;

public class HoldsControllerUnitTests
{
    private readonly Mock<IHoldService> _mockService;
    private readonly HoldsController _controller;

    public HoldsControllerUnitTests()
    {
        _mockService = new Mock<IHoldService>();
        _controller = new HoldsController(_mockService.Object);
    }

    [Fact]
    public void PlaceHold_ReturnsConflict_WhenResultNull()
    {
        _mockService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .Returns((HoldResult?)null);

        var result = _controller.PlaceHold(new PlaceHoldRequest());

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public void PlaceHold_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("Error", "Message");
        var result = _controller.PlaceHold(new PlaceHoldRequest());
        Assert.IsType<BadRequestObjectResult>(result);
    }
}
