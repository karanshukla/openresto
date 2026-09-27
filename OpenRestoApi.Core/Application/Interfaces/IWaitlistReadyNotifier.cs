using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Tells a waiting guest their table is ready. Best effort: never throws.</summary>
public interface IWaitlistReadyNotifier
{
    Task NotifyAsync(WaitlistEntry entry, Restaurant restaurant);
}
