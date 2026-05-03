using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using Xunit;

namespace OpenRestoApi.Tests.Controllers;

public class EmailSettingsControllerUnitTests
{
    private readonly Mock<EmailSettingsService> _mockService;
    private readonly EmailSettingsController _controller;

    public EmailSettingsControllerUnitTests()
    {
        _mockService = new Mock<EmailSettingsService>(null!, null!, null!);
        _controller = new EmailSettingsController(_mockService.Object);
    }

    [Fact]
    public async Task Get_ReturnsEmptyResponse_WhenSettingsNull()
    {
        _mockService.Setup(s => s.GetAsync()).ReturnsAsync((EmailSettings?)null);
        var result = await _controller.Get();
        var okResult = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<EmailSettingsResponse>(okResult.Value);
        Assert.False(resp.IsConfigured);
    }

    [Fact]
    public async Task Test_ReturnsBadRequest_WhenConnectionFails()
    {
        _mockService.Setup(s => s.TestConnectionAsync()).ThrowsAsync(new Exception("Fail"));
        var result = await _controller.Test();
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Test_ReturnsBadRequest_WhenNotConfigured()
    {
        _mockService.Setup(s => s.TestConnectionAsync()).ReturnsAsync(false);
        var result = await _controller.Test();
        Assert.IsType<BadRequestObjectResult>(result);
    }
}
