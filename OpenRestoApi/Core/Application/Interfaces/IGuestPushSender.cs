using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>What a reminder says. The channel decides how it is wrapped.</summary>
public sealed record GuestPushMessage(string Title, string Body, string BookingRef, int BookingId, string Url);

public enum GuestPushOutcome
{
    Delivered,
    /// <summary>The address no longer exists (uninstalled app, revoked browser permission); drop the subscription.</summary>
    Stale,
    Failed,
}

public sealed record GuestPushResult(GuestPushOutcome Outcome, string? Error = null)
{
    public static readonly GuestPushResult Delivered = new(GuestPushOutcome.Delivered);
    public static readonly GuestPushResult Stale = new(GuestPushOutcome.Stale);
    public static GuestPushResult Failed(string error) => new(GuestPushOutcome.Failed, error);
}

/// <summary>Delivers one message to one subscription over whichever channel it was registered on.</summary>
public interface IGuestPushSender
{
    Task<GuestPushResult> SendAsync(GuestPushSubscription subscription, GuestPushMessage message);
}

/// <summary>
/// The Expo push service (<c>https://exp.host/--/api/v2/push/send</c>), which fans out to APNs
/// and FCM using the credentials the self-hoster's EAS project holds. Nothing platform-specific
/// ever reaches this server.
/// </summary>
public interface IExpoPushClient
{
    Task<GuestPushResult> SendAsync(string token, GuestPushMessage message, CancellationToken cancellationToken = default);
}
