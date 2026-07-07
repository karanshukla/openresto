using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Tests.Controllers;

public class AvailabilityControllerUnitTests
{
    [Fact]
    public async Task Get_NotFoundException_Propagates()
    {
        // Post-Bundle-6 the controller no longer catches; NotFoundException propagates
        // to GlobalExceptionHandler which maps it → 404 with a {message} body.
        var mockService = new Mock<IAvailabilityService>();
        mockService.Setup(s => s.GetAvailabilityAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ThrowsAsync(new NotFoundException("Restaurant not found."));

        var controller = new AvailabilityController(mockService.Object);

        NotFoundException ex = await Assert.ThrowsAsync<NotFoundException>(
            () => controller.Get(999, DateTime.Now, 2));
        Assert.Equal("Restaurant not found.", ex.Message);
    }

    // The 500 path for unexpected exceptions is now covered by GlobalExceptionHandlerTests
    // (the mapping lives in middleware, not the controller).

    [Fact]
    public async Task Get_ReturnsOk_OnSuccess()
    {
        var mockService = new Mock<IAvailabilityService>();
        var response = new OpenRestoApi.Core.Application.DTOs.AvailabilityResponseDto { Slots = [] };
        mockService.Setup(s => s.GetAvailabilityAsync(1, It.IsAny<DateTime>(), 2))
            .ReturnsAsync(response);

        var controller = new AvailabilityController(mockService.Object);

        var result = await controller.Get(1, DateTime.Now, 2);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(response, ok.Value);
    }
}
