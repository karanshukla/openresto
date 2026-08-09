namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Picks the booking-reference generator a restaurant has been configured to use. Every place
/// that mints a <see cref="Booking.BookingRef"/> goes through here, so a restaurant's
/// <see cref="Restaurant.BookingRefFormat"/> is the single point that decides the shape.
/// </summary>
public static class BookingRefFactory
{
    public static string GenerateFor(BookingRefFormat format) => format switch
    {
        BookingRefFormat.Numeric => NumericBookingRefGenerator.Generate(),
        _ => BookingRefGenerator.Generate()
    };

    public static string GenerateFor(Restaurant restaurant) => GenerateFor(restaurant.BookingRefFormat);
}
