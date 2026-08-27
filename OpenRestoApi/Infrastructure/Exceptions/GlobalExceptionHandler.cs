using Microsoft.AspNetCore.Diagnostics;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;

namespace OpenRestoApi.Infrastructure.Exceptions;

// Maps typed OpenResto exceptions to HTTP responses, preserving the established
// { "message": "..." } body shape (the frontend, E2E specs, and integration tests
// all read body.message — never RFC 7807 title/detail). The exception TYPE is the
// status discriminator; the handler switch-es on it.
//
// Fallback (untyped) exceptions → 500. In Development the underlying message is
// surfaced for debugging; elsewhere a generic message is returned. InfrastructureException
// is held to the same disclosure rule unless it carries an ErrorCodes value — see
// DiscloseableMessage.
public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment env) : IExceptionHandler
{
    private const string GenericFailureMessage = "An unexpected error occurred.";

    /// <summary>
    /// An <see cref="InfrastructureException"/> carrying a <see cref="OpenRestoException.Code"/>
    /// was shaped for a client by its throw site, so its message is deliberate and safe to return.
    /// An uncoded one is an unclassified failure whose message is whatever the underlying library
    /// said — an SMTP host, a connection string, a file path — so outside Development it is
    /// withheld exactly like an untyped exception's.
    /// </summary>
    /// <seealso>GlobalExceptionHandlerTests.InfrastructureException_Production_WithoutCode_IsGeneric</seealso>
    /// <seealso>GlobalExceptionHandlerTests.InfrastructureException_Production_WithCode_KeepsMessage</seealso>
    private string DiscloseableMessage(InfrastructureException exception) =>
        exception.Code is not null || env.IsDevelopment()
            ? exception.Message
            : GenericFailureMessage;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        (int statusCode, string message) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, exception.Message),
            BusinessRuleException => (StatusCodes.Status400BadRequest, exception.Message),
            InfrastructureException infrastructure => (
                StatusCodes.Status500InternalServerError,
                DiscloseableMessage(infrastructure)),
            _ => (
                StatusCodes.Status500InternalServerError,
                env.IsDevelopment()
                    ? $"An unexpected error occurred: {exception.Message}"
                    : GenericFailureMessage)
        };

        // 5xx are genuine failures worth a stack trace; 4xx are expected domain
        // rejections, logged at Warning for visibility without alerting noise.
        if (statusCode >= 500)
        {
            logger.LogError(exception, "Unhandled exception: {ExceptionType}", exception.GetType().Name);
        }
        else
        {
            logger.LogWarning(exception, "Handled domain exception ({ExceptionType}): {Message}",
                exception.GetType().Name, exception.Message);
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(
            new MessageResponse { Message = message, Code = (exception as OpenRestoException)?.Code },
            cancellationToken);

        return true; // marked handled — default ProblemDetails handler is skipped
    }
}
