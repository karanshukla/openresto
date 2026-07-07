using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Infrastructure.Exceptions;

namespace OpenRestoApi.Tests.Infrastructure;

// Direct tests of GlobalExceptionHandler.TryHandleAsync. These pin the
// exception-type → HTTP-status mapping and the { message: "..." } body shape that
// the frontend (3 API files), E2E specs (3), and integration tests (2) all depend on.
// The handler is the single source of truth for that mapping post-Bundle-6.
public class GlobalExceptionHandlerTests
{
    private readonly Mock<ILogger<GlobalExceptionHandler>> _loggerMock = new();

    private GlobalExceptionHandler CreateHandler(bool isDevelopment = false)
    {
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns(isDevelopment ? "Development" : "Production");
        return new GlobalExceptionHandler(_loggerMock.Object, envMock.Object);
    }

    // DefaultHttpContext.Response.Body defaults to Stream.Null (writes are discarded).
    // Swap in a MemoryStream so tests can read the serialized JSON back.
    private static HttpContext CreateContext()
    {
        var ctx = new DefaultHttpContext
        {
            Response = { Body = new MemoryStream() }
        };
        return ctx;
    }

    private static async Task<(int statusCode, string message)> ReadResponse(HttpContext ctx)
    {
        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        return (
            ctx.Response.StatusCode,
            doc.RootElement.GetProperty("message").GetString() ?? "");
    }

    [Fact]
    public async Task NotFoundException_MapsTo_404()
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new NotFoundException("Restaurant not found."), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.NotFound, status);
        Assert.Equal("Restaurant not found.", message);
    }

    [Fact]
    public async Task ValidationException_MapsTo_400()
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new ValidationException("Password must be at least 6 characters."), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.BadRequest, status);
        Assert.Equal("Password must be at least 6 characters.", message);
    }

    [Fact]
    public async Task ConflictException_MapsTo_409()
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new ConflictException("This table is already booked for that time."), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.Conflict, status);
        Assert.Equal("This table is already booked for that time.", message);
    }

    [Fact]
    public async Task BusinessRuleException_MapsTo_400()
    {
        // BusinessRuleException → 400 (NOT 409): admin-edit flows (AdminUpdateBooking,
        // RestoreBooking) and same-email flow return 400 today. This preserves that.
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new BusinessRuleException("New email must be different from the current email."), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.BadRequest, status);
        Assert.Equal("New email must be different from the current email.", message);
    }

    [Fact]
    public async Task InfrastructureException_MapsTo_500()
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new InfrastructureException("Email is not configured."), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.InternalServerError, status);
        Assert.Equal("Email is not configured.", message);
    }

    [Fact]
    public async Task InfrastructureException_LogsError()
    {
        // 5xx must surface as LogError for alerting; 4xx use Warning.
        GlobalExceptionHandler handler = CreateHandler();

        await handler.TryHandleAsync(
            CreateContext(), new InfrastructureException("boom"), default);

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => true),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task DomainException_LogsWarning()
    {
        // 4xx domain rejections should not trip 5xx alerting thresholds.
        GlobalExceptionHandler handler = CreateHandler();

        await handler.TryHandleAsync(
            CreateContext(), new ConflictException("overlap"), default);

        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => true),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task UntypedException_Production_MapsTo_500_GenericMessage()
    {
        // In Production, unexpected exceptions must NOT leak the inner message.
        GlobalExceptionHandler handler = CreateHandler(isDevelopment: false);
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new InvalidOperationException("DB password is hunter2"), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.InternalServerError, status);
        Assert.Equal("An unexpected error occurred.", message);
        Assert.DoesNotContain("hunter2", message);
    }

    [Fact]
    public async Task UntypedException_Development_MapsTo_500_WithDetail()
    {
        // In Development, the inner message is surfaced for debugging.
        GlobalExceptionHandler handler = CreateHandler(isDevelopment: true);
        HttpContext ctx = CreateContext();

        bool handled = await handler.TryHandleAsync(
            ctx, new InvalidOperationException("DB password is hunter2"), default);

        Assert.True(handled);
        (int status, string message) = await ReadResponse(ctx);
        Assert.Equal((int)HttpStatusCode.InternalServerError, status);
        Assert.Contains("hunter2", message);
    }

    [Theory]
    [InlineData(typeof(NotFoundException), 404)]
    [InlineData(typeof(ValidationException), 400)]
    [InlineData(typeof(ConflictException), 409)]
    [InlineData(typeof(BusinessRuleException), 400)]
    [InlineData(typeof(InfrastructureException), 500)]
    public async Task EachTypedException_MapsToExpectedStatus(Type exceptionType, int expectedStatus)
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        OpenRestoException ex =
            (OpenRestoException)Activator.CreateInstance(exceptionType, "msg")!;
        await handler.TryHandleAsync(ctx, ex, default);

        Assert.Equal(expectedStatus, ctx.Response.StatusCode);
    }

    [Fact]
    public async Task Handler_AlwaysReturnsTrue_MarkingExceptionHandled()
    {
        // The handler must return true (handled) so the default ProblemDetails
        // handler is skipped and our {message} body wins.
        GlobalExceptionHandler handler = CreateHandler();

        bool handled = await handler.TryHandleAsync(
            CreateContext(), new ConflictException("x"), default);

        Assert.True(handled);
    }

    [Fact]
    public async Task Response_IsJson_WithMessageProperty()
    {
        // Guards the exact body contract: a JSON object with a string "message" field.
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        await handler.TryHandleAsync(ctx, new ValidationException("bad input"), default);

        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        Assert.Equal(JsonValueKind.Object, doc.RootElement.ValueKind);
        Assert.True(doc.RootElement.TryGetProperty("message", out JsonElement msg));
        Assert.Equal(JsonValueKind.String, msg.ValueKind);
        Assert.Equal("bad input", msg.GetString());
    }
}
