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
// surfaced for debugging; elsewhere a generic message is returned.
public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment env) : IExceptionHandler
{
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
            InfrastructureException => (StatusCodes.Status500InternalServerError, exception.Message),
            _ => (
                StatusCodes.Status500InternalServerError,
                env.IsDevelopment()
                    ? $"An unexpected error occurred: {exception.Message}"
                    : "An unexpected error occurred.")
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
            new MessageResponse { Message = message },
            cancellationToken);

        return true; // marked handled — default ProblemDetails handler is skipped
    }
}
