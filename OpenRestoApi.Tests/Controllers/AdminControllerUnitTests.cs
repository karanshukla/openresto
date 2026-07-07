using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
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
    public async Task CreateBooking_ValidationException_Propagates()
    {
        // Post-Bundle-6 the controller no longer catches; the typed exception
        // propagates to GlobalExceptionHandler which maps ValidationException → 400.
        _mockAdminService.Setup(s => s.CreateBookingAsync(It.IsAny<AdminCreateBookingRequest>()))
            .ThrowsAsync(new ValidationException("Invalid arg"));

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => _controller.CreateBooking(new AdminCreateBookingRequest()));
        Assert.Equal("Invalid arg", ex.Message);
    }

    [Fact]
    public async Task CreateBooking_ConflictException_Propagates()
    {
        // ConflictException → 409 is mapped by GlobalExceptionHandler.
        _mockAdminService.Setup(s => s.CreateBookingAsync(It.IsAny<AdminCreateBookingRequest>()))
            .ThrowsAsync(new ConflictException("Conflict"));

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => _controller.CreateBooking(new AdminCreateBookingRequest()));
        Assert.Equal("Conflict", ex.Message);
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
    public async Task RestoreBooking_BusinessRuleException_Propagates()
    {
        // BusinessRuleException (booking already active) → 400 is mapped by GlobalExceptionHandler.
        _mockAdminService.Setup(s => s.RestoreBookingAsync(It.IsAny<int>()))
            .ThrowsAsync(new BusinessRuleException("Booking is already active."));

        BusinessRuleException ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => _controller.RestoreBooking(1));
        Assert.Equal("Booking is already active.", ex.Message);
    }

    [Fact]
    public async Task CancelBooking_ConflictException_Propagates()
    {
        // ConflictException (past booking) → 409 is mapped by GlobalExceptionHandler.
        _mockAdminService.Setup(s => s.CancelBookingAsync(It.IsAny<int>()))
            .ThrowsAsync(new ConflictException("Cannot cancel a booking that has already passed."));

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => _controller.CancelBooking(1));
        Assert.Equal("Cannot cancel a booking that has already passed.", ex.Message);
    }

    [Fact]
    public async Task AdminUpdateBooking_ValidationException_Propagates()
    {
        // ValidationException (bad restaurant/table) → 400 is mapped by GlobalExceptionHandler.
        _mockAdminService.Setup(s => s.AdminUpdateBookingAsync(It.IsAny<int>(), It.IsAny<AdminUpdateBookingRequest>()))
            .ThrowsAsync(new ValidationException("Invalid restaurant."));

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => _controller.AdminUpdateBooking(1, new AdminUpdateBookingRequest()));
        Assert.Equal("Invalid restaurant.", ex.Message);
    }

    [Fact]
    public async Task AdminUpdateBooking_BusinessRuleException_Propagates()
    {
        // BusinessRuleException (update-conflict / seats) → 400 is mapped by GlobalExceptionHandler.
        _mockAdminService.Setup(s => s.AdminUpdateBookingAsync(It.IsAny<int>(), It.IsAny<AdminUpdateBookingRequest>()))
            .ThrowsAsync(new BusinessRuleException("This update would cause a conflict with an existing booking."));

        BusinessRuleException ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => _controller.AdminUpdateBooking(1, new AdminUpdateBookingRequest()));
        Assert.Equal("This update would cause a conflict with an existing booking.", ex.Message);
    }
}
