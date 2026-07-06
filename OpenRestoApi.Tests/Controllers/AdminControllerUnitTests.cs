using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Tests.Controllers;

public class AdminControllerUnitTests
{
    private readonly Mock<AdminService> _mockAdminService;
    private readonly AdminController _controller;

    public AdminControllerUnitTests()
    {
        // AdminService needs 5 repositories + IHoldService + IEmailService + 2 optionals.
        // We can pass nulls if we only mock the virtual methods.
        _mockAdminService = new Mock<AdminService>(null!, null!, null!, null!, null!, null!, null!, null!, null!);
        _controller = new AdminController(_mockAdminService.Object);
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
    public async Task SendEmail_EmailServiceException_ReturnsBadRequest()
    {
        // SMTP failures propagate as exceptions from SendBookingEmailAsync; the controller
        // catches them and maps to a 400 with the underlying message.
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ThrowsAsync(new InvalidOperationException("Fail"));

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Contains("Failed to send: Fail", response.Message);
    }

    [Fact]
    public async Task SendEmail_EmailServiceInvalidOp_ReturnsBadRequest()
    {
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ThrowsAsync(new InvalidOperationException("IO Fail"));

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Equal("Failed to send: IO Fail", response.Message);
    }

    [Fact]
    public async Task SendEmail_BookingNotFound_Returns404()
    {
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ReturnsAsync(SendBookingEmailResult.NotFound());

        var result = await _controller.SendEmail(999, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task SendEmail_MissingFields_Returns400()
    {
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ReturnsAsync(SendBookingEmailResult.MissingFields());

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "", Body = "" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Equal("Subject and body are required.", response.Message);
    }

    [Fact]
    public async Task SendEmail_NoCustomerEmail_Returns400()
    {
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ReturnsAsync(SendBookingEmailResult.NoCustomerEmail());

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(badRequest.Value);
        Assert.Equal("Customer email is not available.", response.Message);
    }

    [Fact]
    public async Task SendEmail_Success_ReturnsOkWithRecipient()
    {
        _mockAdminService.Setup(s => s.SendBookingEmailAsync(It.IsAny<int>(), It.IsAny<SendBookingEmailRequest>()))
            .ReturnsAsync(SendBookingEmailResult.Sent("guest@test.com"));

        var result = await _controller.SendEmail(1, new SendBookingEmailRequest { Subject = "S", Body = "B" });

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(ok.Value);
        Assert.Equal("Email sent to guest@test.com.", response.Message);
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
    public async Task CancelBooking_InvalidOperationException_ReturnsConflict()
    {
        _mockAdminService.Setup(s => s.CancelBookingAsync(It.IsAny<int>()))
            .ThrowsAsync(new InvalidOperationException("Cannot cancel a booking that has already passed."));

        var result = await _controller.CancelBooking(1);

        var conflict = Assert.IsType<ConflictObjectResult>(result);
        var response = Assert.IsType<MessageResponse>(conflict.Value);
        Assert.Equal("Cannot cancel a booking that has already passed.", response.Message);
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
