namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Digits-only sibling of <see cref="BookingRefGenerator"/>, for restaurants that would rather
/// read a number down the phone than spell out three words.
/// </summary>
public static class NumericBookingRefGenerator
{
    /// <summary>
    /// Eight digits gives a 90-million-wide space — three orders of magnitude larger than the
    /// word-based generator's ~177k combinations, so switching format cannot make collisions
    /// more likely than they already are.
    /// </summary>
    public const int Digits = 8;

    private static readonly int _min = (int)Math.Pow(10, Digits - 1);
    private static readonly int _max = (int)Math.Pow(10, Digits);

    private static readonly Random _rng = Random.Shared;

    /// <summary>
    /// Returns a reference of exactly <see cref="Digits"/> digits. The leading digit is never
    /// zero, so the reference survives a round-trip through anything that treats it as a number
    /// (a spreadsheet column, a numeric input) without silently shortening.
    /// </summary>
    public static string Generate() => _rng.Next(_min, _max).ToString(System.Globalization.CultureInfo.InvariantCulture);
}
