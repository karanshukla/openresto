using Microsoft.AspNetCore.Mvc;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Tests.Controllers;

public class NotificationsControllerUnitTests
{
    private readonly Mock<INotificationService> _mockService;
    private readonly NotificationsController _controller;

    public NotificationsControllerUnitTests()
    {
        _mockService = new Mock<INotificationService>();
        _controller = new NotificationsController(_mockService.Object);
    }

    // ── GetNotifications ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetNotifications_ReturnsOk()
    {
        _mockService.Setup(s => s.GetNotificationsAsync(null, null, null, 1, 20))
            .ReturnsAsync((new List<AdminNotificationDto>(), 0));

        IActionResult result = await _controller.GetNotifications(null, null, null, 1, 20);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetNotifications_ClampsPageToMin1()
    {
        _mockService.Setup(s => s.GetNotificationsAsync(null, null, null, 1, 20))
            .ReturnsAsync((new List<AdminNotificationDto>(), 0));

        await _controller.GetNotifications(null, null, null, page: 0, pageSize: 20);

        _mockService.Verify(s => s.GetNotificationsAsync(null, null, null, 1, 20), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_ClampsPageSizeToMax100()
    {
        _mockService.Setup(s => s.GetNotificationsAsync(null, null, null, 1, 100))
            .ReturnsAsync((new List<AdminNotificationDto>(), 0));

        await _controller.GetNotifications(null, null, null, page: 1, pageSize: 9999);

        _mockService.Verify(s => s.GetNotificationsAsync(null, null, null, 1, 100), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_PassesFiltersThrough()
    {
        _mockService.Setup(s => s.GetNotificationsAsync(5, "BookingCreated", true, 2, 10))
            .ReturnsAsync((new List<AdminNotificationDto>(), 0));

        await _controller.GetNotifications(5, "BookingCreated", true, 2, 10);

        _mockService.Verify(s => s.GetNotificationsAsync(5, "BookingCreated", true, 2, 10), Times.Once);
    }

    // ── GetUnreadCount ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetUnreadCount_ReturnsOkWithCount()
    {
        _mockService.Setup(s => s.GetUnreadCountAsync(null)).ReturnsAsync(7);

        IActionResult result = await _controller.GetUnreadCount(null);

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task GetUnreadCount_PassesRestaurantIdThrough()
    {
        _mockService.Setup(s => s.GetUnreadCountAsync(3)).ReturnsAsync(2);

        await _controller.GetUnreadCount(3);

        _mockService.Verify(s => s.GetUnreadCountAsync(3), Times.Once);
    }

    // ── MarkRead ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkRead_ReturnsNoContent()
    {
        _mockService.Setup(s => s.MarkReadAsync(42)).Returns(Task.CompletedTask);

        IActionResult result = await _controller.MarkRead(42);

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.MarkReadAsync(42), Times.Once);
    }

    // ── MarkAllRead ───────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkAllRead_ReturnsBadRequest_WhenRestaurantIdZero()
    {
        IActionResult result = await _controller.MarkAllRead(0);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task MarkAllRead_ReturnsBadRequest_WhenRestaurantIdNegative()
    {
        IActionResult result = await _controller.MarkAllRead(-1);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task MarkAllRead_ReturnsNoContent_WhenValidRestaurantId()
    {
        _mockService.Setup(s => s.MarkAllReadAsync(1)).Returns(Task.CompletedTask);

        IActionResult result = await _controller.MarkAllRead(1);

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.MarkAllReadAsync(1), Times.Once);
    }

    // ── GetVapidPublicKey ─────────────────────────────────────────────────────

    [Fact]
    public void GetVapidPublicKey_ReturnsNoContent_WhenNotConfigured()
    {
        _mockService.Setup(s => s.GetVapidPublicKey()).Returns((string?)null);

        IActionResult result = _controller.GetVapidPublicKey();

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public void GetVapidPublicKey_ReturnsOkWithKey_WhenConfigured()
    {
        _mockService.Setup(s => s.GetVapidPublicKey()).Returns("BTest123PublicKey");

        IActionResult result = _controller.GetVapidPublicKey();

        OkObjectResult ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
    }

    // ── Subscribe ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Subscribe_ReturnsOk_WhenValid()
    {
        _mockService.Setup(s => s.SubscribeAsync(It.IsAny<PushSubscribeRequest>())).Returns(Task.CompletedTask);

        IActionResult result = await _controller.Subscribe(new PushSubscribeRequest("ep", "p256", "auth"));

        Assert.IsType<OkResult>(result);
        _mockService.Verify(s => s.SubscribeAsync(It.IsAny<PushSubscribeRequest>()), Times.Once);
    }

    // ── Unsubscribe ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Unsubscribe_ReturnsNoContent()
    {
        _mockService.Setup(s => s.UnsubscribeAsync("https://endpoint")).Returns(Task.CompletedTask);

        IActionResult result = await _controller.Unsubscribe("https://endpoint");

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.UnsubscribeAsync("https://endpoint"), Times.Once);
    }

    // ── DeleteAll ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteAll_ReturnsNoContent()
    {
        _mockService.Setup(s => s.DeleteAllAsync(null, null, null)).Returns(Task.CompletedTask);

        IActionResult result = await _controller.DeleteAll(null, null, null);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task DeleteAll_PassesFiltersThrough()
    {
        _mockService.Setup(s => s.DeleteAllAsync(1, "BookingCreated", true)).Returns(Task.CompletedTask);

        await _controller.DeleteAll(1, "BookingCreated", true);

        _mockService.Verify(s => s.DeleteAllAsync(1, "BookingCreated", true), Times.Once);
    }

    // ── DeleteNotification ────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteNotification_ReturnsNoContent()
    {
        _mockService.Setup(s => s.DeleteByIdAsync(5)).Returns(Task.CompletedTask);

        IActionResult result = await _controller.DeleteNotification(5);

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.DeleteByIdAsync(5), Times.Once);
    }

    // ── DeleteNotifications ───────────────────────────────────────────────────

    [Fact]
    public async Task DeleteNotifications_ReturnsBadRequest_WhenEmptyList()
    {
        IActionResult result = await _controller.DeleteNotifications(new List<int>());
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeleteNotifications_ReturnsBadRequest_WhenNullList()
    {
        IActionResult result = await _controller.DeleteNotifications(null!);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeleteNotifications_ReturnsNoContent_WhenValidList()
    {
        var ids = new List<int> { 1, 2, 3 };
        _mockService.Setup(s => s.DeleteByIdsAsync(ids)).Returns(Task.CompletedTask);

        IActionResult result = await _controller.DeleteNotifications(ids);

        Assert.IsType<NoContentResult>(result);
        _mockService.Verify(s => s.DeleteByIdsAsync(ids), Times.Once);
    }
}
