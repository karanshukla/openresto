using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Utilities;
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

    // ── i18n G: error codes (#375) ──────────────────────────────────────────

    [Fact]
    public async Task ExceptionWithCode_SurfacesCodeInResponseBody()
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        await handler.TryHandleAsync(
            ctx, new ConflictException("Bookings are paused until 18:00. Please choose a later time.") { Code = ErrorCodes.BookingPaused }, default);

        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        Assert.True(doc.RootElement.TryGetProperty("code", out JsonElement code));
        Assert.Equal(ErrorCodes.BookingPaused, code.GetString());
        Assert.Equal("Bookings are paused until 18:00. Please choose a later time.",
            doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ExceptionWithoutCode_OmitsCodePropertyEntirely()
    {
        // Additive-only guard: an unmigrated throw site (Code left null) must not grow a
        // "code": null field on the wire, or any snapshot that only ever saw "message" shifts.
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        await handler.TryHandleAsync(ctx, new ValidationException("Password must be at least 6 characters."), default);

        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        Assert.False(doc.RootElement.TryGetProperty("code", out _));
    }

    [Fact]
    public async Task UntypedException_OmitsCodeProperty()
    {
        // A non-OpenRestoException (the untyped 500 fallback) has no Code to surface at all.
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        await handler.TryHandleAsync(ctx, new InvalidOperationException("boom"), default);

        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        Assert.False(doc.RootElement.TryGetProperty("code", out _));
    }

    // Pins that a representative sample of throw sites migrated for #375 still produce the
    // exact pre-migration English message — the whole point of the ticket is that `message`
    // never moves, only `code` is added alongside it. Each case uses the exact exception type
    // the real throw site uses, so this also pins the status-code mapping stayed put.
    public static IEnumerable<object[]> MigratedThrowSites =>
    [
        [new NotFoundException("Restaurant not found.") { Code = ErrorCodes.RestaurantNotFound }, (int)HttpStatusCode.NotFound],
        [new ConflictException("This table is already booked for that time.") { Code = ErrorCodes.BookingTableConflict }, (int)HttpStatusCode.Conflict],
        [new ConflictException("Cannot create a booking in the past.") { Code = ErrorCodes.BookingPastDate }, (int)HttpStatusCode.Conflict],
        [new ConflictException("No tables are available for the requested time and party size.") { Code = ErrorCodes.BookingNoTablesAvailable }, (int)HttpStatusCode.Conflict],
        [new BusinessRuleException("You cannot deactivate your own account.") { Code = ErrorCodes.UserCannotDeactivateSelf }, (int)HttpStatusCode.BadRequest],
        [new ValidationException("A combinable table group must have at least two members.") { Code = ErrorCodes.TableGroupMinMembers }, (int)HttpStatusCode.BadRequest],
    ];

    [Theory]
    [MemberData(nameof(MigratedThrowSites))]
    public async Task MigratedThrowSite_MessageStaysByteIdentical_CodeAddedAlongside(OpenRestoException exception, int expectedStatus)
    {
        GlobalExceptionHandler handler = CreateHandler();
        HttpContext ctx = CreateContext();

        await handler.TryHandleAsync(ctx, exception, default);

        Assert.Equal(expectedStatus, ctx.Response.StatusCode);
        ctx.Response.Body.Position = 0;
        using JsonDocument doc = await JsonDocument.ParseAsync(ctx.Response.Body);
        Assert.Equal(exception.Message, doc.RootElement.GetProperty("message").GetString());
        Assert.Equal(exception.Code, doc.RootElement.GetProperty("code").GetString());
    }
}
