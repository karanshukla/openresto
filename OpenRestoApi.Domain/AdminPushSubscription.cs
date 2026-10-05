namespace OpenRestoApi.Core.Domain;

/// <summary>
/// One browser's Web Push address for the admin notification fan-out.
///
/// Deliberately not scoped to a restaurant: an admin account sees every location, so a
/// subscription registered while looking at one of them must still deliver bookings made
/// at the others. Rows used to be per (endpoint, restaurant), which meant the fan-out for
/// a location nobody happened to be viewing when they subscribed found no subscribers at
/// all.
/// </summary>
public class AdminPushSubscription
{
    public int Id { get; set; }

    // Web Push subscription fields from the browser's PushSubscription object
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;

    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
}
