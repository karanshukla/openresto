using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Controllers;

public class EmailSettingsControllerUnitTests
{
    private readonly Mock<EmailSettingsService> _mockService;
    private readonly EmailSettingsController _controller;

    public EmailSettingsControllerUnitTests()
    {
        _mockService = new Mock<EmailSettingsService>(null!, null!, null!, null!);
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
        _mockService.Setup(s => s.TestConnectionAsync()).ThrowsAsync(new InvalidOperationException("Fail"));
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

    [Fact]
    public async Task Get_ReturnsSendBookingConfirmations_WhenSettingsExist()
    {
        _mockService.Setup(s => s.GetAsync()).ReturnsAsync(new EmailSettings
        {
            Host = "smtp.test.com",
            Port = 587,
            Username = "user@test.com",
            EncryptedPassword = "enc",
            SendBookingConfirmations = true,
        });

        var result = await _controller.Get();
        var okResult = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<EmailSettingsResponse>(okResult.Value);
        Assert.True(resp.SendBookingConfirmations);
        Assert.True(resp.IsConfigured);
    }

    [Fact]
    public async Task Get_ReturnsSendBookingConfirmationsFalse_ByDefault()
    {
        _mockService.Setup(s => s.GetAsync()).ReturnsAsync(new EmailSettings
        {
            Host = "smtp.test.com",
            Port = 587,
            Username = "user@test.com",
            EncryptedPassword = "enc",
            SendBookingConfirmations = false,
        });

        var result = await _controller.Get();
        var okResult = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<EmailSettingsResponse>(okResult.Value);
        Assert.False(resp.SendBookingConfirmations);
    }

    [Fact]
    public async Task GetFailures_ReturnsOk_WithMappedResponse()
    {
        DateTime attemptedAt = DateTime.UtcNow;
        var failures = new List<EmailFailure>
        {
            new() { Id = 1, BookingRef = "ABC", RecipientEmail = "a@a.com", ErrorMessage = "err", AttemptedAt = attemptedAt }
        };
        _mockService.Setup(s => s.GetFailuresAsync()).ReturnsAsync(failures);

        var result = await _controller.GetFailures();

        var okResult = Assert.IsType<OkObjectResult>(result);
        // Force enumeration of the deferred Select() to exercise the mapping itself
        // (a bare IsType<OkObjectResult> assertion never enumerates the IEnumerable).
        var mapped = Assert.IsAssignableFrom<IEnumerable<EmailFailureResponse>>(okResult.Value).ToList();
        Assert.Single(mapped);
        Assert.Equal(1, mapped[0].Id);
        Assert.Equal("ABC", mapped[0].BookingRef);
        Assert.Equal("a@a.com", mapped[0].RecipientEmail);
        Assert.Equal("err", mapped[0].ErrorMessage);
        Assert.Equal(attemptedAt, mapped[0].AttemptedAt);
    }
}
