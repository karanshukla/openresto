using System.Globalization;
using System.Security.Cryptography;

namespace OpenRestoApi.Core.Domain;

/// <summary>
/// Digits-only sibling of <see cref="BookingRefGenerator"/>, for restaurants that would rather
/// read a number down the phone than spell out three words.
/// </summary>
public static class NumericBookingRefGenerator
{
    /// <summary>
    /// Eight digits gives a 90-million-wide space (~26.4 bits) — narrower than the word format's
    /// <see cref="BookingRefGenerator.CombinationCount"/>, which is the price of a reference short
    /// enough to dictate as one number. It is the tighter of the two shapes and so the one that
    /// bounds a guest booking's secrecy wherever it is selected; a restaurant that wants the wider
    /// secret takes the default format.
    /// </summary>
    public const int Digits = 8;

    private static readonly int _min = (int)Math.Pow(10, Digits - 1);
    private static readonly int _max = (int)Math.Pow(10, Digits);

    /// <summary>
    /// Returns a reference of exactly <see cref="Digits"/> digits. The leading digit is never
    /// zero, so the reference survives a round-trip through anything that treats it as a number
    /// (a spreadsheet column, a numeric input) without silently shortening. Drawn from a CSPRNG
    /// for the reason given on <see cref="BookingRefGenerator"/>: the reference is the secret.
    /// </summary>
    public static string Generate() =>
        RandomNumberGenerator.GetInt32(_min, _max).ToString(CultureInfo.InvariantCulture);
}
