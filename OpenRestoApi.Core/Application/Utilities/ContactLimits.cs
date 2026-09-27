namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Centralized bounds for the optional contact fields that exist at two levels — per-restaurant
/// (<see cref="Domain.Restaurant"/>) and global (<see cref="Domain.BrandSettings"/>) — so the
/// entity annotations, service guards, and frontend inputs all agree on a single source of truth.
/// </summary>
public static class ContactLimits
{
    /// <summary>
    /// Max length of a contact phone number. Generous enough for an international number written
    /// with spaces plus an extension (e.g. "+44 20 7946 0958 ext. 12").
    /// </summary>
    public const int MaxPhoneLength = 32;

    /// <summary>Max length of a contact email address — the RFC 5321 ceiling.</summary>
    public const int MaxEmailLength = 254;
}
