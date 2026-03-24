using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Tests.Holds;

internal class FakeClock(DateTime initial) : ISystemClock
{
    public DateTime UtcNow { get; set; } = initial;

    public void Advance(TimeSpan by) => UtcNow += by;
}
