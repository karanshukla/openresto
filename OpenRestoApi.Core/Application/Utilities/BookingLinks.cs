using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The one URL a guest can manage a booking from, as the confirmation email, the reminder push
/// and both wallet passes hand it out. One builder so the three cannot drift.
/// </summary>
public static class BookingLinks
{
    public static string Confirmation(string websiteUrl, Booking booking) =>
        $"{websiteUrl.TrimEnd('/')}/booking-confirmation/{Uri.EscapeDataString(booking.BookingRef)}?email={Uri.EscapeDataString(booking.CustomerEmail ?? string.Empty)}";
}
