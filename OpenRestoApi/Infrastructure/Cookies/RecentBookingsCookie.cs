using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace OpenRestoApi.Infrastructure.Cookies;

public record CachedBookingEntry(
    string BookingRef,
    string Email,
    string Date,
    int Seats,
    string? RestaurantName,
    string CreatedAt
);

/// <summary>
/// Manages an encrypted HttpOnly cookie containing a user's recent booking references.
/// Uses ASP.NET Data Protection to encrypt the payload so it cannot be read or tampered with client-side.
/// </summary>
public class RecentBookingsCookie(IDataProtectionProvider provider, IWebHostEnvironment env)
{
    private const string _cookieName = "openresto_recent";
    private const int _maxEntries = 10;
    private const int _cookieMaxAgeDays = 90;
    private readonly IDataProtector _protector = provider.CreateProtector("RecentBookings.v1");
    private readonly bool _isDevelopment = env.IsDevelopment();

    /// <summary>Read and decrypt the recent bookings from the request cookie.</summary>
    public List<CachedBookingEntry> Read(HttpRequest request)
    {
        if (!request.Cookies.TryGetValue(_cookieName, out string? encrypted) || string.IsNullOrEmpty(encrypted))
        {
            return [];
        }

        try
        {
            string json = _protector.Unprotect(encrypted);
            return JsonSerializer.Deserialize<List<CachedBookingEntry>>(json) ?? [];
        }
        catch
        {
            // Corrupted or tampered cookie — return empty
            return [];
        }
    }

    /// <summary>Add a booking entry and write the encrypted cookie to the response.</summary>
    public void Append(HttpRequest request, HttpResponse response, CachedBookingEntry entry)
    {
        List<CachedBookingEntry> entries = Read(request);

        // Don't duplicate
        if (entries.Any(e => string.Equals(e.BookingRef, entry.BookingRef, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        entries.Insert(0, entry);

        // Trim to max
        if (entries.Count > _maxEntries)
        {
            entries = entries.Take(_maxEntries).ToList();
        }

        Write(response, entries);
    }

    /// <summary>Write the full list to the response cookie.</summary>
    private void Write(HttpResponse response, List<CachedBookingEntry> entries)
    {
        string json = JsonSerializer.Serialize(entries);
        string encrypted = _protector.Protect(json);

        // In dev (HTTP, cross-origin ports), use Lax + no Secure flag.
        // In production (HTTPS, same origin), use Strict + Secure.
        response.Cookies.Append(_cookieName, encrypted, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_isDevelopment,
            SameSite = _isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
            MaxAge = TimeSpan.FromDays(_cookieMaxAgeDays),
            Path = "/api/bookings",
            IsEssential = true,
        });
    }
}
