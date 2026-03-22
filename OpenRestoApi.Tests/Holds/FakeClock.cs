using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Tests.Holds;

internal class FakeClock : ISystemClock
{
    public DateTime UtcNow { get; set; }

    public FakeClock(DateTime initial) => UtcNow = initial;

    public void Advance(TimeSpan by) => UtcNow += by;
}
