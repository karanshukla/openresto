namespace OpenRestoApi.Core.Domain;

/// <summary>
/// One device that asked to be reminded about one booking. Keyed to the booking, never to a
/// person: it holds a push address and nothing else, cascades away with the booking (so the
/// GDPR purge covers it), and the reminder pass prunes it once the sitting has passed.
/// </summary>
public class GuestPushSubscription
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public Booking Booking { get; set; } = null!;

    /// <summary>One of <see cref="GuestPushChannels"/>.</summary>
    public string Channel { get; set; } = string.Empty;

    /// <summary>An Expo push token for the native app, or the browser's Web Push endpoint URL.</summary>
    public string Endpoint { get; set; } = string.Empty;

    // Web Push key material; null on the Expo channel.
    public string? P256dh { get; set; }
    public string? Auth { get; set; }

    /// <summary>The UI locale the guest opted in under, so the reminder reads in their language.</summary>
    public string Locale { get; set; } = "en";

    public DateTime CreatedAt { get; set; }

    /// <summary>The lead time (hours before the sitting) of the most recent reminder sent, if any.</summary>
    public int? LastReminderLeadHours { get; set; }
    public DateTime? LastReminderSentAt { get; set; }
}

public static class GuestPushChannels
{
    public const string Expo = "expo";
    public const string WebPush = "webpush";

    public static bool IsKnown(string? channel) => channel is Expo or WebPush;
}

public static class GuestPushFields
{
    public const int MaxChannelLength = 16;
    public const int MaxEndpointLength = 2048;
    public const int MaxKeyLength = 512;
    public const int MaxLocaleLength = 8;
}
