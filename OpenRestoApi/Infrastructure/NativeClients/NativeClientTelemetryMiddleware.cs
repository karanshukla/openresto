using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Infrastructure.NativeClients;

/// <summary>
/// Counts the request against its native build, if it declared one. Runs before the rest of the
/// pipeline and only ever touches an in-memory counter, so an unparseable header costs a string
/// comparison and nothing else.
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Infrastructure.NativeClients.*")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.NativeClientTelemetryMiddlewareTests")]
[ExternalAccessAllowed]
internal sealed class NativeClientTelemetryMiddleware(
    RequestDelegate next,
    INativeClientStatsCollector collector,
    ISystemClock clock)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (NativeClientIdentity.TryParse(
                context.Request.Headers[NativeClientIdentity.HeaderName].ToString(),
                out string platform,
                out string version))
        {
            collector.Record(platform, version, clock.UtcNow);
        }

        await next(context);
    }
}

/// <summary>Registers <see cref="NativeClientTelemetryMiddleware"/>.</summary>
public static class NativeClientApplicationBuilderExtensions
{
    public static IApplicationBuilder UseNativeClientTelemetry(this IApplicationBuilder app)
        => app.UseMiddleware<NativeClientTelemetryMiddleware>();
}
