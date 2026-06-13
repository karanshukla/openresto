using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class AdminService(AppDbContext db, IHoldService holdService, INotificationService? notificationService = null)
{
    private readonly AppDbContext _db = db;
    private readonly IHoldService _holdService = holdService;
    private readonly INotificationService? _notificationService = notificationService;

    private static string NormalizeStatus(string status) => status.ToLowerInvariant() switch
    {
        "upcoming" => "active",
        "past" => "past",
        "cancelled" => "cancelled",
        "active" => "active",
        "all" => "all",
        _ => "active",
    };

    public virtual async Task<AdminOverviewDto> GetOverviewAsync()
    {
        DateTime nowUtc = DateTime.UtcNow;
        List<Restaurant> restaurants = await _db.Restaurants.Where(r => !r.IsArchived).ToListAsync();

        int totalRestaurants = restaurants.Count;
        int totalBookings = await _db.Bookings.CountAsync(b => !b.IsCancelled);
        int totalSeats = await _db.Bookings.Where(b => !b.IsCancelled).SumAsync(b => (int?)b.Seats) ?? 0;

        int todayBookingsCount = 0;
        int pausedRestaurantsCount = 0;
        List<BookingDetailDto> todayBookingsList = [];
        foreach (Restaurant? r in restaurants)
        {
            (DateTime start, DateTime end) = GetUtcRangeForLocalDay(nowUtc, r.Timezone);
            List<Booking> rTodayBookings = await _db.Bookings
                .Include(b => b.Restaurant)
                .Include(b => b.Section)
                .Include(b => b.Table)
                .Where(b =>
                    b.RestaurantId == r.Id &&
                    b.Date >= start && b.Date < end &&
                    !b.IsCancelled)
                .OrderBy(b => b.Date)
                .ToListAsync();
            todayBookingsCount += rTodayBookings.Count;
            todayBookingsList.AddRange(rTodayBookings.Select(ToDetailDto));

            if (r.BookingsPausedUntil.HasValue && r.BookingsPausedUntil.Value > nowUtc)
            {
                pausedRestaurantsCount++;
            }
        }

        // Calculate Occupancy Data (Last 7 days) — raw counts first, then normalize to 0-100
        // relative to the peak day so the busiest day fills the chart and others are proportional.
        List<int> rawCounts = [];
        for (int i = 6; i >= 0; i--)
        {
            DateTime dayStart = DateTime.SpecifyKind(nowUtc.Date.AddDays(-i), DateTimeKind.Utc);
            DateTime dayEnd = dayStart.AddDays(1);
            int dayBookings = await _db.Bookings.CountAsync(b => !b.IsCancelled && b.Date >= dayStart && b.Date < dayEnd);
            rawCounts.Add(dayBookings);
        }

        int maxCount = rawCounts.Count > 0 ? rawCounts.Max() : 0;
        List<int> occupancyData = rawCounts
            .Select(count => maxCount > 0 ? (int)Math.Round((double)count / maxCount * 100) : 0)
            .ToList();

        return new AdminOverviewDto
        {
            TotalRestaurants = totalRestaurants,
            TotalBookings = totalBookings,
            TodayBookings = todayBookingsCount,
            TotalSeats = totalSeats,
            ActiveHoldsCount = _holdService.GetActiveHoldsCount(),
            PausedRestaurantsCount = pausedRestaurantsCount,
            OccupancyData = occupancyData,
            TodayBookingsList = [.. todayBookingsList.OrderBy(b => b.Date)],
        };
    }

    public virtual async Task<List<BookingDetailDto>> GetBookingsAsync(int? restaurantId, DateTime? bookingDate, string status, string? email = null, string? bookingRef = null)
    {
        IQueryable<Booking> q = _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .AsQueryable();

        DateTime nowUtc = DateTime.UtcNow;
        string normalized = NormalizeStatus(status);

        // Grid view logic: if a date is explicitly provided, we usually want all bookings for that day
        // unless a specific status (like cancelled) is requested.
        bool isGridMode = bookingDate.HasValue && normalized == "active";

        if (restaurantId.HasValue)
        {
            q = q.Where(b => b.RestaurantId == restaurantId.Value);
            Restaurant? restaurant = await _db.Restaurants.FindAsync(restaurantId.Value);
            string tz = restaurant?.Timezone ?? "UTC";

            DateTime cutoff = nowUtc.AddMinutes(-90);

            if (isGridMode)
            {
                // In grid mode for a specific date, show everything non-cancelled for that day
                q = q.Where(b => !b.IsCancelled);
            }
            else
            {
                q = normalized switch
                {
                    "cancelled" => q.Where(b => b.IsCancelled),
                    "past" => q.Where(b => !b.IsCancelled && b.Date < cutoff),
                    "all" => q,
                    "active" => q.Where(b => !b.IsCancelled && b.Date >= cutoff),
                    _ => q.Where(b => !b.IsCancelled && b.Date >= cutoff),
                };
            }

            if (bookingDate.HasValue)
            {
                (DateTime start, DateTime end) = GetUtcRangeForLocalDay(bookingDate.Value, tz);
                q = q.Where(b => b.Date >= start && b.Date < end);
            }
        }
        else
        {
            if (isGridMode)
            {
                // In grid mode for a specific date, show everything non-cancelled for that day
                q = q.Where(b => !b.IsCancelled);
            }
            else
            {
                DateTime globalCutoff = nowUtc.AddMinutes(-90);

                q = normalized switch
                {
                    "cancelled" => q.Where(b => b.IsCancelled),
                    "past" => q.Where(b => !b.IsCancelled && b.Date < globalCutoff),
                    "all" => q,
                    "active" => q.Where(b => !b.IsCancelled && b.Date >= globalCutoff),
                    _ => q.Where(b => !b.IsCancelled && b.Date >= globalCutoff),
                };
            }

            if (bookingDate.HasValue)
            {
                DateTime dayStart = bookingDate.Value.Date;
                DateTime nextDayStart = dayStart.AddDays(1);
                q = q.Where(b => b.Date >= dayStart && b.Date < nextDayStart);
            }
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            // SQLite EF Core cannot translate StringComparison overloads — use ToLower for case-insensitive LIKE
            string normalizedEmail = email.Trim().ToLowerInvariant();
            // EF Core maps ToLower() → SQLite lower(), which is locale-independent at the DB level
#pragma warning disable CA1862, CA1311, CA1304 // ToLower in LINQ-to-EF is intentional (ToLowerInvariant is not translatable)
            q = q.Where(b => b.CustomerEmail != null && b.CustomerEmail.ToLower().Contains(normalizedEmail));
#pragma warning restore CA1862, CA1311, CA1304
        }

        if (!string.IsNullOrWhiteSpace(bookingRef))
        {
            string normalizedRef = bookingRef.Trim().ToLowerInvariant();
#pragma warning disable CA1862, CA1311, CA1304
            q = q.Where(b => b.BookingRef != null && b.BookingRef.ToLower().Contains(normalizedRef));
#pragma warning restore CA1862, CA1311, CA1304
        }

        return await q
            .OrderBy(b => b.Date)
            .Select(b => ToDetailDto(b))
            .ToListAsync();
    }

    public virtual async Task<BookingDetailDto?> GetBookingAsync(int id)
    {
        Booking? b = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .FirstOrDefaultAsync(b => b.Id == id);

        return b == null ? null : ToDetailDto(b);
    }

    public virtual async Task<BookingDetailDto> CreateBookingAsync(AdminCreateBookingRequest req)
    {
        Table table = await _db.Tables
            .Include(t => t.Section)
                .ThenInclude(s => s!.Restaurant)
            .FirstOrDefaultAsync(t => t.Id == req.TableId && t.SectionId == req.SectionId)
            ?? throw new ArgumentException("Table not found in the specified section.");

        if (table.Section!.RestaurantId != req.RestaurantId)
        {
            throw new ArgumentException("Section does not belong to this restaurant.");
        }

        // Normalize date: if Unspecified, treat as restaurant local and convert to UTC
        DateTime newStart;
        if (req.Date.Kind == DateTimeKind.Unspecified)
        {
            TimeZoneInfo tz;
            try { tz = TimeZoneInfo.FindSystemTimeZoneById(table.Section.Restaurant!.Timezone); }
            catch { tz = TimeZoneInfo.Utc; }
            newStart = TimeZoneInfo.ConvertTimeToUtc(req.Date, tz);
        }
        else
        {
            newStart = req.Date.ToUniversalTime();
        }

        DateTime newEnd = newStart.AddHours(1);

        bool conflict = await _db.Bookings.AnyAsync(b =>
            b.TableId == req.TableId &&
            !b.IsCancelled &&
            b.Date < newEnd &&
            (b.EndTime != null ? b.EndTime > newStart : b.Date.AddHours(1) > newStart));

        if (conflict)
        {
            throw new InvalidOperationException("This table already has a booking that overlaps with the requested time.");
        }

        if (req.Seats > table.Seats)
        {
            throw new InvalidOperationException($"This table only has {table.Seats} seats, but {req.Seats} guests were requested.");
        }

        var booking = new Booking
        {
            RestaurantId = req.RestaurantId,
            SectionId = req.SectionId,
            TableId = req.TableId,
            Date = newStart,
            EndTime = newStart.AddHours(1),
            CustomerEmail = req.CustomerEmail,
            CustomerName = req.CustomerName,
            Seats = req.Seats,
            BookingRef = BookingRefGenerator.Generate(),
        };

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        // Reload to get names and ensure UTC consistency
        await _db.Entry(booking).Reference(b => b.Table).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Section).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Restaurant).LoadAsync();

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.NotifyBookingCreatedAsync(booking, booking.Restaurant!.Name);
                await _notificationService.CheckAndNotifyCapacityAsync(booking.RestaurantId, booking.Restaurant!.Name, booking.Date);
            }
            catch (Exception ex) { Console.WriteLine($"[AdminService] Notification failed for ref {booking.BookingRef}: {ex.Message}"); }
        }

        return ToDetailDto(booking);
    }

    public virtual async Task<DateTime?> ExtendBookingAsync(int id, int minutes)
    {
        Booking? booking = await _db.Bookings.FindAsync(id);
        if (booking == null)
        {
            return null;
        }

        // Use EndTime if it's valid (after Date), otherwise fall back to Date + 1h
        DateTime from = (booking.EndTime.HasValue && booking.EndTime.Value > booking.Date)
            ? booking.EndTime.Value
            : booking.Date.AddHours(1);

        booking.EndTime = from.AddMinutes(minutes);
        await _db.SaveChangesAsync();
        return booking.EndTime;
    }

    public virtual async Task<bool> CancelBookingAsync(int id)
    {
        Booking? booking = await _db.Bookings.FindAsync(id);
        if (booking == null)
        {
            return false;
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (_notificationService != null)
        {
            try
            {
                await _db.Entry(booking).Reference(b => b.Restaurant).LoadAsync();
                await _notificationService.NotifyBookingCancelledAsync(booking, booking.Restaurant?.Name ?? "");
            }
            catch (Exception ex) { Console.WriteLine($"[AdminService] Notification failed for booking {id}: {ex.Message}"); }
        }

        return true;
    }

    public virtual async Task<bool> PurgeBookingAsync(int id)
    {
        Booking? booking = await _db.Bookings.FindAsync(id);
        if (booking == null)
        {
            return false;
        }

        _db.Bookings.Remove(booking);
        await _db.SaveChangesAsync();
        return true;
    }

    public virtual async Task<BookingDetailDto?> RestoreBookingAsync(int id)
    {
        Booking? booking = await _db.Bookings.FindAsync(id);
        if (booking == null)
        {
            return null;
        }

        if (!booking.IsCancelled)
        {
            throw new InvalidOperationException("Booking is already active.");
        }

        booking.IsCancelled = false;
        booking.CancelledAt = null;
        await _db.SaveChangesAsync();

        return ToDetailDto(booking);
    }

    public virtual async Task<BookingDetailDto?> AdminUpdateBookingAsync(int id, AdminUpdateBookingRequest req)
    {
        Booking? booking = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null)
        {
            return null;
        }

        // Validate restaurant exists if changing
        if (req.RestaurantId.HasValue && req.RestaurantId.Value != booking.RestaurantId)
        {
            var restaurantExists = await _db.Restaurants.AnyAsync(r => r.Id == req.RestaurantId.Value);
            if (!restaurantExists)
            {
                throw new ArgumentException("Invalid restaurant.");
            }
            booking.RestaurantId = req.RestaurantId.Value;
        }

        // Validate table exists and belongs to the (possibly new) restaurant
        if (req.TableId.HasValue && req.TableId.Value != booking.TableId)
        {
            Table? table = await _db.Tables
                .Include(t => t.Section)
                .FirstOrDefaultAsync(t => t.Id == req.TableId.Value && t.Section!.RestaurantId == booking.RestaurantId);

            if (table == null)
            {
                throw new ArgumentException("Invalid table for this restaurant.");
            }
            booking.TableId = req.TableId.Value;
            booking.SectionId = table.SectionId;
        }
        else if (req.SectionId.HasValue)
        {
            throw new ArgumentException("Provide tableId when reassigning to a different section.");
        }

        // Update other fields
        if (req.Date.HasValue && req.Date.Value != booking.Date)
        {
            // If date changed, we should also shift EndTime by the same amount to keep duration
            if (booking.EndTime.HasValue)
            {
                TimeSpan duration = booking.EndTime.Value - booking.Date;
                booking.EndTime = req.Date.Value + duration;
            }
            else
            {
                // Default to 1 hour if EndTime was missing for some reason
                booking.EndTime = req.Date.Value.AddHours(1);
            }
            booking.Date = req.Date.Value;
        }

        // Final safety check: EndTime should never be before Date
        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }

        // --- CONFLICT CHECK ---
        // If either the Date or Table changed, verify that the new slot doesn't conflict with existing bookings
        if ((req.Date.HasValue && req.Date.Value != booking.Date) || (req.TableId.HasValue && req.TableId.Value != booking.TableId))
        {
            DateTime newStart = booking.Date.ToUniversalTime();
            DateTime newEnd = booking.EndTime ?? newStart.AddHours(1);

            bool conflict = await _db.Bookings.AnyAsync(b =>
                b.Id != id && // Exclude the current booking itself
                b.TableId == booking.TableId &&
                !b.IsCancelled &&
                b.Date < newEnd &&
                (b.EndTime != null ? b.EndTime > newStart : b.Date.AddHours(1) > newStart));

            if (conflict)
            {
                throw new InvalidOperationException("This update would cause a conflict with an existing booking.");
            }
        }

        if (req.Seats.HasValue)
        {
            int? resolvedTableId = req.TableId ?? booking.TableId;
            if (resolvedTableId.HasValue)
            {
                Table? currentTable = await _db.Tables.FindAsync(resolvedTableId.Value);
                if (currentTable != null && req.Seats.Value > currentTable.Seats)
                {
                    throw new InvalidOperationException($"This table only has {currentTable.Seats} seats, but {req.Seats.Value} guests were requested.");
                }
            }
            booking.Seats = req.Seats.Value;
        }
        if (req.CustomerEmail != null)
        {
            booking.CustomerEmail = req.CustomerEmail;
        }
        if (req.CustomerName != null)
        {
            booking.CustomerName = string.IsNullOrWhiteSpace(req.CustomerName) ? null : req.CustomerName.Trim();
        }
        if (req.SpecialRequests != null)
        {
            booking.SpecialRequests = req.SpecialRequests;
        }

        await _db.SaveChangesAsync();

        // Reload to get updated names
        await _db.Entry(booking).Reference(b => b.Restaurant).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Section).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Table).LoadAsync();

        return ToDetailDto(booking);
    }

    public virtual async Task<List<LookupDto>> GetRestaurantsAsync()
    {
        DateTime nowUtc = DateTime.UtcNow;

        return await _db.Restaurants
            .OrderBy(r => r.Name)
            .Select(r => new LookupDto
            {
                Id = r.Id,
                Name = r.Name,
                BookingsPausedUntil = r.BookingsPausedUntil,
                IsArchived = r.IsArchived,
                ActiveBookingsCount = _db.Bookings.Count(b =>
                    b.RestaurantId == r.Id &&
                    !b.IsCancelled &&
                    b.Date <= nowUtc &&
                    (b.EndTime == null || b.EndTime > nowUtc))
            })
            .ToListAsync();
    }

    public virtual async Task<List<LookupDto>> GetSectionsAsync(int restaurantId)
    {
        return await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .OrderBy(s => s.Name)
            .Select(s => new LookupDto { Id = s.Id, Name = s.Name })
            .ToListAsync();
    }

    // ── Restaurants ─────────────────────────────────────────────────────────

    public virtual async Task<bool> PauseRestaurantBookingsAsync(int restaurantId, int durationMinutes)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.BookingsPausedUntil = DateTime.UtcNow.AddMinutes(durationMinutes);
        await _db.SaveChangesAsync();
        return true;
    }

    public virtual async Task<bool> UnpauseRestaurantBookingsAsync(int restaurantId)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.BookingsPausedUntil = null;
        await _db.SaveChangesAsync();
        return true;
    }

    public virtual async Task<List<BookingDetailDto>?> ExtendAllActiveBookingsAsync(int restaurantId, int extensionMinutes)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(restaurantId);
        if (restaurant == null)
        {
            return null;
        }

        DateTime nowUtc = DateTime.UtcNow;

        // Active bookings are those that are currently in progress and not cancelled
        List<Booking> activeBookings = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .Where(b => b.RestaurantId == restaurantId &&
                        !b.IsCancelled &&
                        b.Date <= nowUtc &&
                        (b.EndTime == null || b.EndTime > nowUtc))
            .ToListAsync();

        foreach (Booking? booking in activeBookings)
        {
            DateTime currentEndTime = booking.EndTime ?? booking.Date.AddHours(1);
            booking.EndTime = currentEndTime.AddMinutes(extensionMinutes);
        }

        await _db.SaveChangesAsync();
        return activeBookings.Select(ToDetailDto).ToList();
    }

    public virtual async Task<RestaurantDto> CreateRestaurantAsync(string name, string? address)
    {
        var restaurant = new Restaurant { Name = name.Trim(), Address = address?.Trim() };
        _db.Restaurants.Add(restaurant);
        await _db.SaveChangesAsync();

        return new RestaurantDto
        {
            Id = restaurant.Id,
            Name = restaurant.Name,
            Address = restaurant.Address,
            Sections = [],
        };
    }

    public virtual async Task<bool> SetArchivedAsync(int id, bool archived)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.IsArchived = archived;
        await _db.SaveChangesAsync();
        return true;
    }

    public virtual async Task<bool> DeleteRestaurantAsync(int id)
    {
        Restaurant? restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null)
        {
            return false;
        }

        List<Booking> bookings = await _db.Bookings.Where(b => b.RestaurantId == id).ToListAsync();
        _db.Bookings.RemoveRange(bookings);
        _db.Restaurants.Remove(restaurant);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Tables ──────────────────────────────────────────────────────────────

    public virtual async Task<List<SectionDto>?> GetTablesAsync(int restaurantId)
    {
        List<Section> sections = await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .Include(s => s.Tables)
            .OrderBy(s => s.Name)
            .ToListAsync();

        if (sections.Count == 0)
        {
            return null;
        }

        return sections.Select(s => new SectionDto
        {
            Id = s.Id,
            Name = s.Name,
            Tables = s.Tables.Select(t => new TableDto
            {
                Id = t.Id,
                Name = t.Name,
                Seats = t.Seats,
            }).ToList(),
        }).ToList();
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static (DateTime Start, DateTime End) GetUtcRangeForLocalDay(DateTime referenceDate, string timezoneId)
    {
        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        }
        catch
        {
            tz = TimeZoneInfo.Utc;
        }

        // When given a UTC timestamp (e.g. from GetOverviewAsync), convert to the restaurant's
        // local time first so we get the correct local calendar date — a UTC+ restaurant may
        // already be on the next calendar day while UTC is still "yesterday".
        // When given an Unspecified value (a client date-only param like "2026-05-26"), treat
        // it directly as the restaurant's local date without conversion.
        DateTime localDay = referenceDate.Kind == DateTimeKind.Utc
            ? TimeZoneInfo.ConvertTimeFromUtc(referenceDate, tz).Date
            : referenceDate.Date;

        DateTime localStart = DateTime.SpecifyKind(localDay, DateTimeKind.Unspecified);
        DateTime localEnd = DateTime.SpecifyKind(localDay.AddDays(1), DateTimeKind.Unspecified);

        DateTime utcStart = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        DateTime utcEnd = TimeZoneInfo.ConvertTimeToUtc(localEnd, tz);

        return (utcStart, utcEnd);
    }

    private static BookingDetailDto ToDetailDto(Booking b)
    {
        // Force UTC kind to ensure JSON serializer adds the 'Z' suffix
        DateTime dateUtc = b.Date.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(b.Date, DateTimeKind.Utc)
            : b.Date.ToUniversalTime();

        DateTime? endTimeUtc = null;
        if (b.EndTime.HasValue)
        {
            endTimeUtc = b.EndTime.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(b.EndTime.Value, DateTimeKind.Utc)
                : b.EndTime.Value.ToUniversalTime();
        }

        DateTime? cancelledAtUtc = null;
        if (b.CancelledAt.HasValue)
        {
            cancelledAtUtc = b.CancelledAt.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(b.CancelledAt.Value, DateTimeKind.Utc)
                : b.CancelledAt.Value.ToUniversalTime();
        }

        return new BookingDetailDto
        {
            Id = b.Id,
            RestaurantId = b.RestaurantId,
            RestaurantName = b.Restaurant?.Name,
            SectionId = b.SectionId,
            SectionName = b.Section?.Name ?? (b.SectionId.HasValue ? $"Section {b.SectionId}" : "Section"),
            TableId = b.TableId,
            TableName = b.Table?.Name ?? (b.TableId.HasValue ? $"Table {b.TableId}" : "Table"),
            Date = dateUtc,
            EndTime = endTimeUtc,
            CustomerEmail = b.CustomerEmail,
            CustomerName = b.CustomerName,
            Seats = b.Seats,
            SpecialRequests = b.SpecialRequests,
            BookingRef = b.BookingRef,
            IsCancelled = b.IsCancelled,
            CancelledAt = cancelledAtUtc,
        };
    }
}
