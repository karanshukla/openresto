namespace OpenRestoApi.Core.Domain;

/// <summary>
/// One party waiting at the door for a table. Independent of <see cref="Booking"/>: an entry
/// has no table and no time until staff seat it, at which point a booking is created and
/// linked through <see cref="BookingId"/>.
/// </summary>
public class WaitlistEntry
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;

    /// <summary>
    /// The guest's handle on the entry: unguessable, since knowing it is enough to read the
    /// entry's status and leave the queue.
    /// </summary>
    public string Ref { get; set; } = string.Empty;

    /// <summary>The ticket number staff call out, counting from 1 each local day per location.</summary>
    public int Number { get; set; }

    public string Name { get; set; } = string.Empty;
    public int Seats { get; set; }
    public string? Email { get; set; }

    /// <summary>The UI locale the guest joined under, so the "table ready" email reads in their language.</summary>
    public string Locale { get; set; } = "en";

    /// <summary>
    /// The one device that asked to be pushed when the table is ready (one of
    /// <see cref="GuestPushChannels"/>), or null. The device that turned it on last wins, and it is
    /// cleared when the entry leaves the queue.
    /// </summary>
    public string? PushChannel { get; set; }
    public string? PushEndpoint { get; set; }

    // Web Push key material; null on the Expo channel.
    public string? PushP256dh { get; set; }
    public string? PushAuth { get; set; }

    public WaitlistStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? NotifiedAt { get; set; }

    /// <summary>When the entry left the queue, whether seated, withdrawn or expired.</summary>
    public DateTime? ClosedAt { get; set; }

    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }

    public bool IsActive => Status is WaitlistStatus.Waiting or WaitlistStatus.Notified;

    public GuestPushAddress? PushAddress()
        => PushChannel is null || PushEndpoint is null
            ? null
            : new GuestPushAddress(PushChannel, PushEndpoint, PushP256dh, PushAuth);

    public void ClearPush()
    {
        PushChannel = null;
        PushEndpoint = null;
        PushP256dh = null;
        PushAuth = null;
    }
}

public enum WaitlistStatus
{
    Waiting,
    Notified,
    Seated,
    Left,
    Expired,
}

public static class WaitlistFields
{
    public const int RefLength = 20;
    public const int MaxNameLength = 80;
    public const int MaxStatusLength = 16;
}
