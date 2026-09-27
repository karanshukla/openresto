using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The service window a restaurant falls back to when it has no usable hours of its own.
/// The entity, the DTOs it maps to, the create path and the unparseable-stored-time
/// fallbacks in availability all read it from here: a booking time picker built from one
/// default while the server enforces another offers slots the server then rejects.
/// <c>"00:00"</c>/<c>"23:59"</c> remain valid stored values for a 24h venue — only the
/// fallback lives here.
/// </summary>
public static class OpeningHourDefaults
{
    public const string Open = "09:00";
    public const string Close = "22:00";

    public static (int Hour, int Minute) OpenAt { get; } = Split(Open);
    public static (int Hour, int Minute) CloseAt { get; } = Split(Close);

    private static (int Hour, int Minute) Split(string time)
    {
        string[] parts = time.Split(':');
        return (
            int.Parse(parts[0], CultureInfo.InvariantCulture),
            int.Parse(parts[1], CultureInfo.InvariantCulture));
    }
}
