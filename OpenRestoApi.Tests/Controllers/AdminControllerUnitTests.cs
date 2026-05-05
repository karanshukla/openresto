using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using Xunit;

namespace OpenRestoApi.Tests.Controllers;

public class AdminControllerUnitTests
{
    private readonly Mock<AdminService> _mockAdminService;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly AdminController _controller;

    public AdminControllerUnitTests()
    {
        // AdminService needs AppDbContext and IHoldService.
        // We can pass nulls if we only mock the virtual methods.
        _mockAdminService = new Mock<AdminService>(null!, null!);
        _mockEmailService = new Mock<IEmailService>();
        _controller = new AdminController(_mockAdminService.Object, _mockEmailService.Object);
    }

    [Fact]
    public async Task CreateBooking_ArgumentException_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.CreateBookingAsync(It.IsAny<AdminCreateBookingRequest>()))
            .ThrowsAsync(new ArgumentException("Invalid arg"));

        var result = await _controller.CreateBooking(new AdminCreateBookingRequest());

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Equal("Invalid arg", response.Message);
    }

    [Fact]
    public async Task CreateBooking_InvalidOperationException_ReturnsConflict()
    {
        _mockAdminService.Setup(s => s.CreateBookingAsync(It.IsAny<AdminCreateBookingRequest>()))
            .ThrowsAsync(new InvalidOperationException("Conflict"));

        var result = await _controller.CreateBooking(new AdminCreateBookingRequest());

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(conflict.Value);
        Assert.Equal("Conflict", response.Message);
    }

    [Fact]
    public async Task UpdateBooking_ArgumentException_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.UpdateBookingAsync(It.IsAny<int>(), It.IsAny<UpdateBookingRequest>()))
            .ThrowsAsync(new ArgumentException("Err"));

        var result = await _controller.UpdateBooking(1, new UpdateBookingRequest());

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateBooking_InvalidOperationException_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.UpdateBookingAsync(It.IsAny<int>(), It.IsAny<UpdateBookingRequest>()))
            .ThrowsAsync(new InvalidOperationException("Err"));

        var result = await _controller.UpdateBooking(1, new UpdateBookingRequest());

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SendEmail_EmailServiceException_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.GetBookingAsync(It.IsAny<int>()))
            .ReturnsAsync(new BookingDetailDto { CustomerEmail = "t@t.com" });
        _mockEmailService.Setup(s => s.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("Fail"));

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Contains("Failed to send: Fail", response.Message);
    }
    
    [Fact]
    public async Task SendEmail_EmailServiceInvalidOp_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.GetBookingAsync(It.IsAny<int>()))
            .ReturnsAsync(new BookingDetailDto { CustomerEmail = "t@t.com" });
        _mockEmailService.Setup(s => s.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("IO Fail"));

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Equal("Failed to send: IO Fail", response.Message);
    }

    [Fact]
    public async Task RestoreBooking_InvalidOperationException_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.RestoreBookingAsync(It.IsAny<int>()))
            .ThrowsAsync(new InvalidOperationException("Err"));

        var result = await _controller.RestoreBooking(1);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task AdminUpdateBooking_Exceptions_ReturnBadRequest()
    {
        _mockAdminService.Setup(s => s.AdminUpdateBookingAsync(It.IsAny<int>(), It.IsAny<AdminUpdateBookingRequest>()))
            .ThrowsAsync(new ArgumentException("A"));
        Assert.IsType<BadRequestObjectResult>(await _controller.AdminUpdateBooking(1, new AdminUpdateBookingRequest()));

        _mockAdminService.Setup(s => s.AdminUpdateBookingAsync(It.IsAny<int>(), It.IsAny<AdminUpdateBookingRequest>()))
            .ThrowsAsync(new InvalidOperationException("I"));
        Assert.IsType<BadRequestObjectResult>(await _controller.AdminUpdateBooking(1, new AdminUpdateBookingRequest()));
    }
}
