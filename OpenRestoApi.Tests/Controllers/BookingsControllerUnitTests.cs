using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Cookies;

namespace OpenRestoApi.Tests.Controllers;

public class BookingsControllerUnitTests
{
    private readonly Mock<BookingService> _mockBookingService;
    private readonly Mock<RecentBookingsCookie> _mockRecentCookie;
    private readonly BookingsController _controller;

    public BookingsControllerUnitTests()
    {
        _mockBookingService = new Mock<BookingService>(null!, null!, null!, null!, null!, null!, null!, null!);

        var mockProvider = new Mock<IDataProtectionProvider>();
        mockProvider.Setup(p => p.CreateProtector(It.IsAny<string>())).Returns(new Mock<IDataProtector>().Object);
        var mockEnv = new Mock<IWebHostEnvironment>();

        _mockRecentCookie = new Mock<RecentBookingsCookie>(mockProvider.Object, mockEnv.Object);
        _controller = new BookingsController(_mockBookingService.Object, _mockRecentCookie.Object);
    }

    [Fact]
    public async Task CreateBooking_ConflictException_Propagates()
    {
        // Post-Bundle-6 the controller no longer catches; ConflictException propagates
        // to GlobalExceptionHandler which maps it → 409 with a {message} body.
        _mockBookingService.Setup(s => s.CreateBookingAsync(It.IsAny<BookingDto>()))
            .ThrowsAsync(new ConflictException("Conflict"));

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => _controller.CreateBooking(new BookingDto()));
        Assert.Equal("Conflict", ex.Message);
    }

    [Fact]
    public async Task GetBooking_ReturnsNotFound_WhenNull()
    {
        _mockBookingService.Setup(s => s.GetBookingByIdAsync(It.IsAny<int>())).ReturnsAsync((BookingDto?)null);
        Assert.IsType<NotFoundResult>(await _controller.GetBooking(1));
    }

    [Fact]
    public async Task GetBookingByRef_ReturnsBadRequest_WhenEmailEmpty()
    {
        var result = await _controller.GetBookingByRef("R", "");
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetBookingByRef_ReturnsNotFound_WhenMismatch()
    {
        _mockBookingService.Setup(s => s.GetBookingByRefAsync("R")).ReturnsAsync(new BookingDto { CustomerEmail = "a@a.com" });
        var result = await _controller.GetBookingByRef("R", "b@b.com");
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task CreateBooking_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("E", "M");
        var result = await _controller.CreateBooking(new BookingDto());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateBooking_ReturnsBadRequest_WhenIdMismatch()
    {
        var result = await _controller.UpdateBooking(1, new BookingDto { Id = 2 });
        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UpdateBooking_ReturnsBadRequest_WhenModelStateInvalid()
    {
        _controller.ModelState.AddModelError("E", "M");
        var result = await _controller.UpdateBooking(1, new BookingDto { Id = 1 });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancelBookingByRef_ReturnsBadRequest_WhenEmailEmpty()
    {
        var result = await _controller.CancelBookingByRef("R", new CancelBookingByRefRequest { Email = " " });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancelBookingByRef_ReturnsNotFound_WhenFail()
    {
        _mockBookingService.Setup(s => s.CancelBookingAsync("R", "a@a.com")).ReturnsAsync(false);
        var result = await _controller.CancelBookingByRef("R", new CancelBookingByRefRequest { Email = "a@a.com" });
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task CancelBookingByRef_ConflictException_Propagates_WhenBookingIsInThePast()
    {
        // ConflictException → 409 is mapped by GlobalExceptionHandler.
        _mockBookingService.Setup(s => s.CancelBookingAsync("R", "a@a.com"))
            .ThrowsAsync(new ConflictException("Cannot cancel a booking that has already passed."));

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => _controller.CancelBookingByRef("R", new CancelBookingByRefRequest { Email = "a@a.com" }));
        Assert.Contains("already passed", ex.Message);
    }
}
