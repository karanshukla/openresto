using Microsoft.AspNetCore.Http;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.NativeClients;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// What the request pipeline contributes: a native build's header is counted, everything else
/// (the web app, a scanner, a forged value) passes through uncounted, and either way the request
/// carries on.
/// </summary>
public class NativeClientTelemetryMiddlewareTests
{
    private sealed class RecordingCollector : INativeClientStatsCollector
    {
        public List<(string Platform, string Version, DateTime At)> Records { get; } = [];

        public void Record(string platform, string appVersion, DateTime nowUtc)
            => Records.Add((platform, appVersion, nowUtc));

        public IReadOnlyList<NativeClientObservation> Drain() => [];
    }

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => new(2026, 8, 31, 10, 0, 0, DateTimeKind.Utc);
    }

    private static async Task<(RecordingCollector Collector, bool ReachedNext)> InvokeAsync(string? header)
    {
        var collector = new RecordingCollector();
        bool reachedNext = false;
        var middleware = new NativeClientTelemetryMiddleware(
            _ => { reachedNext = true; return Task.CompletedTask; },
            collector,
            new FixedClock());

        var context = new DefaultHttpContext();
        if (header != null)
        {
            context.Request.Headers[NativeClientIdentity.HeaderName] = header;
        }

        await middleware.InvokeAsync(context);
        return (collector, reachedNext);
    }

    [Fact]
    public async Task CountsARequestCarryingANativeClientHeader()
    {
        (RecordingCollector collector, bool reachedNext) = await InvokeAsync("android/1.9.0");

        Assert.True(reachedNext);
        (string platform, string version, DateTime at) = Assert.Single(collector.Records);
        Assert.Equal("android", platform);
        Assert.Equal("1.9.0", version);
        Assert.Equal(new FixedClock().UtcNow, at);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("web/1.9.0")]
    [InlineData("'; DROP TABLE NativeClientStats; --")]
    public async Task CountsNothingForAHeaderThatIsNotANativeClient(string? header)
    {
        (RecordingCollector collector, bool reachedNext) = await InvokeAsync(header);

        Assert.True(reachedNext);
        Assert.Empty(collector.Records);
    }
}
