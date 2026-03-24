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

        DateTime todayStart = DateTime.Today;

        q = NormalizeStatus(status) switch
        {
            "cancelled" => q.Where(b => b.IsCancelled),
            "past" => q.Where(b => !b.IsCancelled && b.Date < todayStart),
            _ => q.Where(b => !b.IsCancelled && b.Date >= todayStart),
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

        return new BookingDetailDto
        {
            Id = booking.Id,
            RestaurantId = booking.RestaurantId,
            RestaurantName = table.Section?.Restaurant?.Name,
            SectionId = booking.SectionId,
            SectionName = table.Section?.Name,
            TableId = booking.TableId,
            TableName = table.Name ?? $"Table {table.Id}",
            Date = booking.Date,
            EndTime = booking.EndTime,
            CustomerEmail = booking.CustomerEmail,
            Seats = booking.Seats,
            BookingRef = booking.BookingRef,
        };
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

        if (req.Date.HasValue)
        {
            booking.Date = req.Date.Value;
        }

        if (req.Seats.HasValue)
        {
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

        DateTime from = booking.EndTime ?? booking.Date.AddHours(1);
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

    private static BookingDetailDto ToDetailDto(Booking b) => new()
    {
        Id = b.Id,
        RestaurantId = b.RestaurantId,
        RestaurantName = b.Restaurant?.Name,
        SectionId = b.SectionId,
        SectionName = b.Section?.Name,
        TableId = b.TableId,
        TableName = b.Table?.Name ?? $"Table {b.TableId}",
        Date = b.Date,
        EndTime = b.EndTime,
        CustomerEmail = b.CustomerEmail,
        Seats = b.Seats,
        SpecialRequests = b.SpecialRequests,
        BookingRef = b.BookingRef,
        IsCancelled = b.IsCancelled,
        CancelledAt = b.CancelledAt,
    };
}
