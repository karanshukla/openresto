using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Tests.Controllers;

public class MediaControllerUnitTests
{
    private readonly Mock<MediaService> _mockService;
    private readonly MediaController _controller;

    public MediaControllerUnitTests()
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(Path.GetTempPath());
        _mockService = new Mock<MediaService>(null!, null!, env.Object);
        _controller = new MediaController(_mockService.Object);
    }

    private static IFormFile CreateFile(string contentType, long length)
    {
        var mock = new Mock<IFormFile>();
        mock.Setup(f => f.ContentType).Returns(contentType);
        mock.Setup(f => f.Length).Returns(length);
        mock.Setup(f => f.OpenReadStream()).Returns(new MemoryStream(new byte[Math.Min(length, 16)]));
        return mock.Object;
    }

    [Fact]
    public async Task UploadHero_ReturnsBadRequest_ForDisallowedContentType()
    {
        IActionResult result = await _controller.UploadHero(CreateFile("image/gif", 100));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadHero_ReturnsBadRequest_WhenOverSizeLimit()
    {
        IActionResult result = await _controller.UploadHero(CreateFile("image/png", 6 * 1024 * 1024));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadHero_ReturnsOkWithUrl_OnSuccess()
    {
        _mockService.Setup(s => s.UploadHeroAsync(It.IsAny<Stream>(), "image/png"))
            .ReturnsAsync("/media/hero.png?v=1");

        IActionResult result = await _controller.UploadHero(CreateFile("image/png", 100));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("/media/hero.png?v=1", ok.Value!.GetType().GetProperty("url")!.GetValue(ok.Value));
    }

    [Fact]
    public async Task DeleteHero_ReturnsNoContent()
    {
        _mockService.Setup(s => s.DeleteHeroAsync()).Returns(Task.CompletedTask);

        IActionResult result = await _controller.DeleteHero();

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.DeleteHeroAsync(), Times.Once);
    }

    [Fact]
    public async Task UploadLocation_ReturnsBadRequest_ForDisallowedContentType()
    {
        IActionResult result = await _controller.UploadLocation(1, CreateFile("image/gif", 100));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadLocation_ReturnsBadRequest_WhenOverSizeLimit()
    {
        IActionResult result = await _controller.UploadLocation(1, CreateFile("image/jpeg", 3 * 1024 * 1024));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadLocation_ReturnsNotFound_WhenServiceReturnsNull()
    {
        _mockService.Setup(s => s.UploadLocationAsync(1, It.IsAny<Stream>(), "image/png"))
            .ReturnsAsync((string?)null);

        IActionResult result = await _controller.UploadLocation(1, CreateFile("image/png", 100));

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UploadLocation_ReturnsOkWithUrl_OnSuccess()
    {
        _mockService.Setup(s => s.UploadLocationAsync(1, It.IsAny<Stream>(), "image/webp"))
            .ReturnsAsync("/media/location-1.webp?v=1");

        IActionResult result = await _controller.UploadLocation(1, CreateFile("image/webp", 100));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("/media/location-1.webp?v=1", ok.Value!.GetType().GetProperty("url")!.GetValue(ok.Value));
    }

    [Fact]
    public async Task DeleteLocation_ReturnsNotFound_WhenServiceReturnsFalse()
    {
        _mockService.Setup(s => s.DeleteLocationAsync(1)).ReturnsAsync(false);

        IActionResult result = await _controller.DeleteLocation(1);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteLocation_ReturnsNoContent_WhenServiceReturnsTrue()
    {
        _mockService.Setup(s => s.DeleteLocationAsync(1)).ReturnsAsync(true);

        IActionResult result = await _controller.DeleteLocation(1);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task UploadMenu_ReturnsBadRequest_ForDisallowedContentType()
    {
        IActionResult result = await _controller.UploadMenu(1, CreateFile("image/png", 100));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadMenu_ReturnsBadRequest_WhenOverSizeLimit()
    {
        IActionResult result = await _controller.UploadMenu(1, CreateFile("application/pdf", 11 * 1024 * 1024));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadMenu_ReturnsNotFound_WhenServiceReturnsNull()
    {
        _mockService.Setup(s => s.UploadMenuAsync(1, It.IsAny<Stream>()))
            .ReturnsAsync((string?)null);

        IActionResult result = await _controller.UploadMenu(1, CreateFile("application/pdf", 100));

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UploadMenu_ReturnsOkWithUrl_OnSuccess()
    {
        _mockService.Setup(s => s.UploadMenuAsync(1, It.IsAny<Stream>()))
            .ReturnsAsync("/media/menu-1.pdf?v=1");

        IActionResult result = await _controller.UploadMenu(1, CreateFile("application/pdf", 100));

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("/media/menu-1.pdf?v=1", ok.Value!.GetType().GetProperty("url")!.GetValue(ok.Value));
    }

    [Fact]
    public async Task DeleteMenu_ReturnsNotFound_WhenServiceReturnsFalse()
    {
        _mockService.Setup(s => s.DeleteMenuAsync(1)).ReturnsAsync(false);

        IActionResult result = await _controller.DeleteMenu(1);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteMenu_ReturnsNoContent_WhenServiceReturnsTrue()
    {
        _mockService.Setup(s => s.DeleteMenuAsync(1)).ReturnsAsync(true);

        IActionResult result = await _controller.DeleteMenu(1);

        Assert.IsType<NoContentResult>(result);
    }
}
