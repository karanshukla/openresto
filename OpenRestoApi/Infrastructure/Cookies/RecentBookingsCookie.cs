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
public class RecentBookingsCookie
{
    private const string CookieName = "openresto_recent";
    private const int MaxEntries = 10;
    private const int CookieMaxAgeDays = 90;
    private readonly IDataProtector _protector;
    private readonly bool _isDevelopment;

    public RecentBookingsCookie(IDataProtectionProvider provider, IWebHostEnvironment env)
    {
        _protector = provider.CreateProtector("RecentBookings.v1");
        _isDevelopment = env.IsDevelopment();
    }

    /// <summary>Read and decrypt the recent bookings from the request cookie.</summary>
    public List<CachedBookingEntry> Read(HttpRequest request)
    {
        if (!request.Cookies.TryGetValue(CookieName, out var encrypted) || string.IsNullOrEmpty(encrypted))
        {
            return [];
        }

        try
        {
            var json = _protector.Unprotect(encrypted);
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
        var entries = Read(request);

        // Don't duplicate
        if (entries.Any(e => string.Equals(e.BookingRef, entry.BookingRef, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        entries.Insert(0, entry);

        // Trim to max
        if (entries.Count > MaxEntries)
        {
            entries = entries.Take(MaxEntries).ToList();
        }

        Write(response, entries);
    }

    /// <summary>Write the full list to the response cookie.</summary>
    private void Write(HttpResponse response, List<CachedBookingEntry> entries)
    {
        var json = JsonSerializer.Serialize(entries);
        var encrypted = _protector.Protect(json);

        // In dev (HTTP, cross-origin ports), use Lax + no Secure flag.
        // In production (HTTPS, same origin), use Strict + Secure.
        response.Cookies.Append(CookieName, encrypted, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_isDevelopment,
            SameSite = _isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
            MaxAge = TimeSpan.FromDays(CookieMaxAgeDays),
            Path = "/api/bookings",
            IsEssential = true,
        });
    }
}
