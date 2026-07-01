using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

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
        var testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12); // Always 12:00 PM tomorrow UTC
        _mockRestaurantRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new OpenRestoApi.Core.Domain.Restaurant
            {
                Id = 1,
                Timezone = "UTC",
                OpenTime = "00:00",
                CloseTime = "23:59"
            });
        _mockBookingRepo.Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>()))
            .ReturnsAsync(false);
        _mockService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>()))
            .Returns((HoldResult?)null);

        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = testDate });

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("Error", "Message");
        var result = await _controller.PlaceHold(new PlaceHoldRequest());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_PassesRestaurantConfiguredDuration_ToBookingConflictCheck()
    {
        var testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12);
        _mockRestaurantRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new OpenRestoApi.Core.Domain.Restaurant
            {
                Id = 1,
                Timezone = "UTC",
                OpenTime = "00:00",
                CloseTime = "23:59",
                DefaultBookingDurationMinutes = 90
            });
        _mockBookingRepo.Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(false);
        _mockService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns(new HoldResult("hold-1", DateTime.UtcNow.AddMinutes(5)));

        await _controller.PlaceHold(new PlaceHoldRequest { Date = testDate });

        _mockBookingRepo.Verify(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), 90), Times.Once);
        _mockService.Verify(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), 90), Times.Once);
    }

    private void SetupPerDayHoursRestaurant()
    {
        // Uniform hours 09:00–17:00, but the requested day's override is 12:00–14:00.
        _mockRestaurantRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new OpenRestoApi.Core.Domain.Restaurant
            {
                Id = 1,
                Timezone = "UTC",
                OpenTime = "09:00",
                CloseTime = "17:00",
                OpenHoursJson = """{"1":{"open":"12:00","close":"14:00"},"2":{"open":"12:00","close":"14:00"},"3":{"open":"12:00","close":"14:00"},"4":{"open":"12:00","close":"14:00"},"5":{"open":"12:00","close":"14:00"},"6":{"open":"12:00","close":"14:00"},"7":{"open":"12:00","close":"14:00"}}"""
            });
        _mockBookingRepo.Setup(b => b.IsTableBookedOnDateAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(false);
        _mockService.Setup(s => s.PlaceHold(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<int>()))
            .Returns(new HoldResult("hold-1", DateTime.UtcNow.AddMinutes(5)));
    }

    [Fact]
    public async Task PlaceHold_ReturnsBadRequest_WhenOutsidePerDayHours()
    {
        SetupPerDayHoursRestaurant();

        // 10:00 is inside the uniform 09:00–17:00 but outside the per-day 12:00–14:00
        var testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = testDate });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PlaceHold_Succeeds_WithinPerDayHours()
    {
        SetupPerDayHoursRestaurant();

        var testDate = DateTime.UtcNow.Date.AddDays(1).AddHours(12).AddMinutes(30);
        var result = await _controller.PlaceHold(new PlaceHoldRequest { Date = testDate });

        Assert.IsType<OkObjectResult>(result);
    }
}
