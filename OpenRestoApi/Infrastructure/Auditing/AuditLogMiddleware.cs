using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Auditing;

/// <summary>
/// Writes the audit entry for a request once the rest of the pipeline has finished with it.
/// <para>
/// Position matters twice over. It sits <em>outside</em> <c>UseExceptionHandler</c>, so by the
/// time it runs a thrown <c>BusinessRuleException</c> has already been mapped and
/// <c>Response.StatusCode</c> is the 400 the caller actually received rather than the 200 it
/// still was inside MVC's filters. And it sits outside <c>UseForwardedHeaders</c>, so
/// <c>RemoteIpAddress</c> is the client's rather than nginx's.
/// </para>
/// <para>
/// The write goes through its own DI scope. Sharing the request's <c>DbContext</c> would mean
/// this <c>SaveChanges</c> flushing whatever a half-finished service left tracked on it —
/// committing, as a side effect of logging, the very mutation that threw.
/// </para>
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Infrastructure.Auditing.*")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.AuditLogMiddlewareTests")]
[ExternalAccessAllowed]
internal sealed class AuditLogMiddleware(
    RequestDelegate next,
    IServiceScopeFactory scopeFactory,
    ILogger<AuditLogMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);

        try
        {
            await RecordAsync(context);
        }
        catch (Exception ex)
        {
            // The response has already gone out; there is nothing to fail. Losing the entry is
            // bad, so it is logged loudly rather than swallowed.
            logger.LogError(ex, "[Audit] Failed to record {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }
    }

    private async Task RecordAsync(HttpContext context)
    {
        // Reads are out of scope for v1 and nothing describes one, so the overwhelming
        // majority of requests leave here without resolving anything. Auditing a read would
        // mean lifting this first.
        if (!AuditRequestClassifier.IsMutatingMethod(context.Request.Method)) return;

        AuditScope? scope = context.RequestServices.GetService<AuditScope>();
        if (scope is null) return;

        if (!scope.IsDescribed && !AuditRequestClassifier.IsAuditableAdminRequest(context)) return;

        await using AsyncServiceScope writeScope = scopeFactory.CreateAsyncScope();
        var repository = writeScope.ServiceProvider.GetRequiredService<IAdminAuditRepository>();
        var clock = writeScope.ServiceProvider.GetRequiredService<ISystemClock>();

        AuditActor actor = await ResolveActorAsync(context, scope, writeScope.ServiceProvider);

        await repository.AddAsync(Build(context, scope, actor, clock.UtcNow));
    }

    private sealed record AuditActor(int? UserId, string Email, string? DisplayName, string Role);

    /// <summary>
    /// The claims are the default, an explicit <c>AttributeTo</c> wins, and the display name is
    /// filled from the account row — it is the one thing the token doesn't carry, and an entry
    /// listing a bare address for someone the rest of the admin shows by name reads as a
    /// different person.
    /// </summary>
    private static async Task<AuditActor> ResolveActorAsync(
        HttpContext context, AuditScope scope, IServiceProvider writeScopeServices)
    {
        int? userId;
        string? email;
        string? displayName = scope.ActorDisplayName;
        string? role;

        if (scope.HasExplicitActor)
        {
            userId = scope.ActorUserId;
            email = scope.ActorEmail;
            role = scope.ActorRole;
        }
        else
        {
            ICurrentUserService? currentUser = context.RequestServices.GetService<ICurrentUserService>();
            userId = currentUser?.UserId;
            email = currentUser?.Email;
            role = currentUser?.Role;
        }

        if (displayName is null && userId.HasValue)
        {
            var credentials = writeScopeServices.GetRequiredService<IAdminCredentialRepository>();
            AdminCredential? account = await credentials.GetByIdAsync(userId.Value);
            displayName = account?.DisplayName;
            email ??= account?.Email;
            role ??= account?.Role;
        }

        return new AuditActor(userId, email ?? string.Empty, displayName, role ?? string.Empty);
    }

    private static AdminAuditEntry Build(
        HttpContext context, AuditScope scope, AuditActor actor, DateTime occurredAt) => new()
        {
            OccurredAt = occurredAt,
            ActorUserId = actor.UserId,
            ActorEmail = AuditFields.Truncate(actor.Email, AuditFields.MaxActorEmailLength)!,
            ActorDisplayName = AuditFields.Truncate(actor.DisplayName, AuditFields.MaxActorDisplayNameLength),
            ActorRole = AuditFields.Truncate(actor.Role, AuditFields.MaxRoleLength)!,
            Action = AuditFields.Truncate(
            scope.Action ?? AuditActions.ForUndescribedRequest(context.Request.Method),
            AuditFields.MaxActionLength)!,
            TargetType = AuditFields.Truncate(scope.TargetType, AuditFields.MaxTargetTypeLength),
            TargetId = AuditFields.Truncate(scope.TargetId, AuditFields.MaxTargetIdLength),
            TargetLabel = AuditFields.Truncate(scope.TargetLabel, AuditFields.MaxTargetLabelLength),
            RestaurantId = scope.RestaurantId,
            Summary = AuditFields.Truncate(scope.Summary, AuditFields.MaxSummaryLength),
            ChangesJson = scope.ChangesJson(),
            HttpMethod = AuditFields.Truncate(context.Request.Method, AuditFields.MaxHttpMethodLength)!,
            // Path only. Admin list screens filter by customer email through the query string, and
            // an audit row is not allowed to hold customer PII.
            Path = AuditFields.Truncate(context.Request.Path.Value ?? string.Empty, AuditFields.MaxPathLength)!,
            StatusCode = context.Response.StatusCode,
            IpAddress = AuditFields.Truncate(
            context.Connection.RemoteIpAddress?.ToString(), AuditFields.MaxIpAddressLength),
            UserAgent = AuditFields.Truncate(
            context.Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null,
            AuditFields.MaxUserAgentLength),
        };
}

/// <summary>Registers <see cref="AuditLogMiddleware"/>; see that type for why order matters.</summary>
public static class AuditingApplicationBuilderExtensions
{
    public static IApplicationBuilder UseAdminAuditLog(this IApplicationBuilder app)
        => app.UseMiddleware<AuditLogMiddleware>();
}
