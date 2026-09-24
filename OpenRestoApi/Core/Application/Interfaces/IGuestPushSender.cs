using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// What a guest push says. The channel decides how it is wrapped. <paramref name="Url"/> is what
/// a click opens; <paramref name="Tag"/> lets a newer message replace an older one about the same
/// booking or ticket instead of stacking beside it.
/// </summary>
public sealed record GuestPushMessage(string Title, string Body, string Url, string Tag);

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

/// <summary>Delivers one message to one address over whichever channel it was registered on.</summary>
public interface IGuestPushSender
{
    Task<GuestPushResult> SendAsync(GuestPushAddress address, GuestPushMessage message);
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
