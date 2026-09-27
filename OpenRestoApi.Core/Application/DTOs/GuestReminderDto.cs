using System.ComponentModel.DataAnnotations;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// A guest asking to be reminded about a booking. <c>Email</c> is the second half of the
/// guest's identity alongside the reference in the route, exactly as on lookup and cancel.
/// </summary>
public class GuestReminderSubscribeRequest
{
    [Required]
    public string Email { get; set; } = string.Empty;

    /// <summary>"expo" from the native app, "webpush" from a browser.</summary>
    [Required, StringLength(GuestPushFields.MaxChannelLength)]
    public string Channel { get; set; } = string.Empty;

    /// <summary>The Expo push token, or the Web Push subscription endpoint.</summary>
    [Required, StringLength(GuestPushFields.MaxEndpointLength)]
    public string Endpoint { get; set; } = string.Empty;

    [StringLength(GuestPushFields.MaxKeyLength)]
    public string? P256dh { get; set; }

    [StringLength(GuestPushFields.MaxKeyLength)]
    public string? Auth { get; set; }

    [StringLength(GuestPushFields.MaxLocaleLength)]
    public string? Locale { get; set; }
}

public class GuestReminderUnsubscribeRequest
{
    [Required]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(GuestPushFields.MaxEndpointLength)]
    public string Endpoint { get; set; } = string.Empty;
}

/// <summary>Where a booking's Google Wallet pass can be saved from.</summary>
public class GoogleWalletLinkResponse
{
    public string SaveUrl { get; set; } = string.Empty;
}

/// <summary>Which wallet passes this instance can issue, so a client offers only those.</summary>
public class WalletAvailabilityResponse
{
    public bool Apple { get; set; }
    public bool Google { get; set; }
}
