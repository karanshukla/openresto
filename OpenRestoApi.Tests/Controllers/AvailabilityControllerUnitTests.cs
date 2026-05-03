using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Tests.Controllers;

public class AvailabilityControllerUnitTests
{
    [Fact]
    public async Task Get_ReturnsInternalServerError_OnException()
    {
        // Arrange
        var mockService = new Mock<AvailabilityService>(null!, null!, null!);
        mockService.Setup(s => s.GetAvailabilityAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<int>()))
            .ThrowsAsync(new InvalidOperationException("Unexpected error"));

        var controller = new AvailabilityController(mockService.Object);

        // Act
        var result = await controller.Get(1, DateTime.Now, 2);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, objectResult.StatusCode);
    }
}
