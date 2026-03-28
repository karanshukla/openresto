using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class AdminService(AppDbContext db)
{
    private readonly AppDbContext _db = db;

    private static string NormalizeStatus(string status) => status.ToLowerInvariant() switch
    {
        "upcoming" => "active",
        "past" => "past",
        "cancelled" => "cancelled",
        _ => "active",
    };

    public async Task<AdminOverviewDto> GetOverviewAsync()
    {
        DateTime todayUtc = DateTime.UtcNow.Date;
        return new AdminOverviewDto
        {
            TotalRestaurants = await _db.Restaurants.CountAsync(),
            TotalBookings = await _db.Bookings.CountAsync(),
            TodayBookings = await _db.Bookings.CountAsync(b => b.Date.Date == todayUtc),
            TotalSeats = await _db.Bookings.SumAsync(b => (int?)b.Seats) ?? 0,
        };
    }

    public async Task<List<BookingDetailDto>> GetBookingsAsync(int? restaurantId, DateTime? date, string status)
    {
        IQueryable<Booking> q = _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .AsQueryable();

        DateTime utcNow = DateTime.UtcNow;
        DateTime todayUtc = utcNow.Date;

        q = NormalizeStatus(status) switch
        {
            "cancelled" => q.Where(b => b.IsCancelled),
            "past" => q.Where(b => !b.IsCancelled && b.Date < todayUtc),
            _ => q.Where(b => !b.IsCancelled && b.Date >= todayUtc),
        };
        if (restaurantId.HasValue)
        {
            q = q.Where(b => b.RestaurantId == restaurantId.Value);
        }

        if (date.HasValue)
        {
            q = q.Where(b => b.Date.Date == date.Value.Date);
        }

        return await q
            .OrderBy(b => b.Date)
            .Select(b => ToDetailDto(b))
            .ToListAsync();
    }

    public async Task<BookingDetailDto?> GetBookingAsync(int id)
    {
        Booking? b = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .FirstOrDefaultAsync(b => b.Id == id);

        return b == null ? null : ToDetailDto(b);
    }

    public async Task<BookingDetailDto> CreateBookingAsync(AdminCreateBookingRequest req)
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

        bool conflict = await _db.Bookings.AnyAsync(b =>
            b.TableId == req.TableId &&
            b.Date.Date == req.Date.Date &&
            !b.IsCancelled);

        if (conflict)
        {
            throw new InvalidOperationException("This table already has a booking on that date.");
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
            Date = req.Date,
            EndTime = req.Date.AddHours(1),
            CustomerEmail = req.CustomerEmail,
            Seats = req.Seats,
            BookingRef = BookingRefGenerator.Generate(),
        };

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        // Reload to get names and ensure UTC consistency
        await _db.Entry(booking).Reference(b => b.Table).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Section).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Restaurant).LoadAsync();

        return ToDetailDto(booking);
    }

    public async Task<BookingDetailDto?> UpdateBookingAsync(int id, UpdateBookingRequest req)
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

        if (req.Date.HasValue && req.Date.Value != booking.Date)
        {
            if (booking.EndTime.HasValue)
            {
                var duration = booking.EndTime.Value - booking.Date;
                booking.EndTime = req.Date.Value + duration;
            }
            else
            {
                booking.EndTime = req.Date.Value.AddHours(1);
            }
            booking.Date = req.Date.Value;
        }

        if (req.Seats.HasValue)
        {
            if (req.Seats.Value > booking.Table.Seats)
            {
                throw new InvalidOperationException($"This table only has {booking.Table.Seats} seats, but {req.Seats.Value} guests were requested.");
            }
            booking.Seats = req.Seats.Value;
        }

        if (!string.IsNullOrEmpty(req.CustomerEmail))
        {
            booking.CustomerEmail = req.CustomerEmail;
        }

        if (req.TableId.HasValue)
        {
            int sectionId = req.SectionId ?? booking.SectionId;
            Table table = await _db.Tables
                .Include(t => t.Section)
                .FirstOrDefaultAsync(t => t.Id == req.TableId.Value && t.SectionId == sectionId)
                ?? throw new ArgumentException("Table not found in the specified section.");
            booking.TableId = table.Id;
            booking.SectionId = table.SectionId;
        }
        else if (req.SectionId.HasValue)
        {
            throw new ArgumentException("Provide tableId when reassigning to a different section.");
        }

        // Final safety check: EndTime should never be before Date
        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }

        await _db.SaveChangesAsync();
        return ToDetailDto(booking);
    }

    public async Task<DateTime?> ExtendBookingAsync(int id, int minutes)
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

    public async Task<bool> CancelBookingAsync(int id)
    {
        Booking? booking = await _db.Bookings.FindAsync(id);
        if (booking == null)
        {
            return false;
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> PurgeBookingAsync(int id)
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

    public async Task<BookingDetailDto?> RestoreBookingAsync(int id)
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

    public async Task<BookingDetailDto?> AdminUpdateBookingAsync(int id, AdminUpdateBookingRequest req)
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
        else if (req.SectionId.HasValue && req.SectionId.Value != booking.SectionId)
        {
            // If only section changed but not table (might happen if user just selects section)
            var sectionExists = await _db.Sections.AnyAsync(s => s.Id == req.SectionId.Value && s.RestaurantId == booking.RestaurantId);
            if (!sectionExists)
            {
                throw new ArgumentException("Invalid section for this restaurant.");
            }
            booking.SectionId = req.SectionId.Value;
        }

        // Update other fields
        if (req.Date.HasValue && req.Date.Value != booking.Date)
        {
            // If date changed, we should also shift EndTime by the same amount to keep duration
            if (booking.EndTime.HasValue)
            {
                var duration = booking.EndTime.Value - booking.Date;
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
        if (req.Seats.HasValue)
        {
            // If table is also changing, we use the new table's capacity
            int tableId = req.TableId ?? booking.TableId;
            Table currentTable = (req.TableId.HasValue && req.TableId.Value != booking.TableId)
                ? (await _db.Tables.FindAsync(req.TableId.Value))!
                : booking.Table;

            if (req.Seats.Value > currentTable.Seats)
            {
                throw new InvalidOperationException($"This table only has {currentTable.Seats} seats, but {req.Seats.Value} guests were requested.");
            }
            booking.Seats = req.Seats.Value;
        }
        if (req.CustomerEmail != null)
        {
            booking.CustomerEmail = req.CustomerEmail;
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

    public async Task<List<LookupDto>> GetRestaurantsAsync()
    {
        return await _db.Restaurants
            .OrderBy(r => r.Name)
            .Select(r => new LookupDto { Id = r.Id, Name = r.Name })
            .ToListAsync();
    }

    public async Task<List<LookupDto>> GetSectionsAsync(int restaurantId)
    {
        return await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .OrderBy(s => s.Name)
            .Select(s => new LookupDto { Id = s.Id, Name = s.Name })
            .ToListAsync();
    }

    // ── Restaurants ─────────────────────────────────────────────────────────

    public async Task<RestaurantDto> CreateRestaurantAsync(string name, string? address)
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

    public async Task<bool> DeleteRestaurantAsync(int id)
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

    public async Task<List<SectionDto>?> GetTablesAsync(int restaurantId)
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

        return new BookingDetailDto
        {
            Id = b.Id,
            RestaurantId = b.RestaurantId,
            RestaurantName = b.Restaurant?.Name,
            SectionId = b.SectionId,
            SectionName = b.Section?.Name,
            TableId = b.TableId,
            TableName = b.Table?.Name ?? $"Table {b.TableId}",
            Date = dateUtc,
            EndTime = endTimeUtc,
            CustomerEmail = b.CustomerEmail,
            Seats = b.Seats,
            SpecialRequests = b.SpecialRequests,
            BookingRef = b.BookingRef,
            IsCancelled = b.IsCancelled,
            CancelledAt = b.CancelledAt,
        };
    }
}
