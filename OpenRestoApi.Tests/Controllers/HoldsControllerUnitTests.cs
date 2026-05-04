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
    private readonly Mock<IRestaurantRepository> _mockRestaurantRepo;
    private readonly Mock<IBookingRepository> _mockBookingRepo;
    private readonly HoldsController _controller;

    public HoldsControllerUnitTests()
    {
        _mockService = new Mock<IHoldService>();
        _mockRestaurantRepo = new Mock<IRestaurantRepository>();
        _mockBookingRepo = new Mock<IBookingRepository>();
        _controller = new HoldsController(_mockService.Object, _mockRestaurantRepo.Object, _mockBookingRepo.Object);
    }

    [Fact]
    public async Task PlaceHold_ReturnsConflict_WhenResultNull()
    {
        _mockRestaurantRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new OpenRestoApi.Core.Domain.Restaurant { Id = 1, Timezone = "UTC" });
        _mockBookingRepo.Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(false);
        _mockService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .Returns((HoldResult?)null);

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = DateTime.UtcNow.AddDays(1) });

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("Error", "Message");
        var result = await _controller.PlaceHold(new PlaceHoldRequest());
        Assert.IsType<BadRequestObjectResult>(result);
    }
}
