using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db) => _db = db;

    // ── Overview / dashboard stats ────────────────────────────────────────────

    /// <summary>Returns aggregate stats for the admin dashboard.</summary>
    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
    {
        var todayUtc = DateTime.UtcNow.Date;
        var overview = new AdminOverviewDto
        {
            TotalRestaurants = await _db.Restaurants.CountAsync(),
            TotalBookings    = await _db.Bookings.CountAsync(),
            TodayBookings    = await _db.Bookings.CountAsync(b => b.Date.Date == todayUtc),
            TotalSeats       = await _db.Bookings.SumAsync(b => (int?)b.Seats) ?? 0,
        };
        return Ok(overview);
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    /// <summary>
    /// List all bookings. Optional query filters:
    ///   ?restaurantId=1  — scope to one location
    ///   ?date=2025-06-15 — scope to a specific date (UTC)
    /// </summary>
    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings(
        [FromQuery] int? restaurantId,
        [FromQuery] DateTime? date,
        [FromQuery] bool cancelled = false)
    {
        var q = _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .AsQueryable();

        // Filter by cancelled status
        q = q.Where(b => b.IsCancelled == cancelled);

        if (restaurantId.HasValue)
            q = q.Where(b => b.RestaurantId == restaurantId.Value);

        if (date.HasValue)
            q = q.Where(b => b.Date.Date == date.Value.Date);

        var results = await q
            .OrderBy(b => b.Date)
            .Select(b => new BookingDetailDto
            {
                Id             = b.Id,
                RestaurantId   = b.RestaurantId,
                RestaurantName = b.Restaurant.Name,
                SectionId      = b.SectionId,
                SectionName    = b.Section.Name,
                TableId        = b.TableId,
                TableName      = b.Table.Name ?? $"Table {b.TableId}",
                Date           = b.Date,
                EndTime        = b.EndTime,
                CustomerEmail  = b.CustomerEmail,
                Seats          = b.Seats,
                SpecialRequests = b.SpecialRequests,
                BookingRef     = b.BookingRef,
                IsCancelled    = b.IsCancelled,
                CancelledAt    = b.CancelledAt,
            })
            .ToListAsync();

        return Ok(results);
    }

    /// <summary>Get a single booking by ID (with resolved names).</summary>
    [HttpGet("bookings/{id}")]
    public async Task<IActionResult> GetBooking(int id)
    {
        var b = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (b == null) return NotFound();

        return Ok(new BookingDetailDto
        {
            Id              = b.Id,
            RestaurantId    = b.RestaurantId,
            RestaurantName  = b.Restaurant.Name,
            SectionId       = b.SectionId,
            SectionName     = b.Section.Name,
            TableId         = b.TableId,
            TableName       = b.Table.Name ?? $"Table {b.TableId}",
            Date            = b.Date,
            EndTime         = b.EndTime,
            CustomerEmail   = b.CustomerEmail,
            Seats           = b.Seats,
            SpecialRequests = b.SpecialRequests,
            BookingRef      = b.BookingRef,
        });
    }

    /// <summary>
    /// Create a walk-in / admin booking without requiring a hold.
    /// The admin can book any available table directly.
    /// </summary>
    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] AdminCreateBookingRequest req)
    {
        var table = await _db.Tables
            .Include(t => t.Section)
            .FirstOrDefaultAsync(t => t.Id == req.TableId && t.SectionId == req.SectionId);

        if (table == null)
            return BadRequest(new { message = "Table not found in the specified section." });

        if (table.Section?.RestaurantId != req.RestaurantId)
            return BadRequest(new { message = "Section does not belong to this restaurant." });

        // Conflict: any existing booking on the same table on the same calendar day
        var conflict = await _db.Bookings.AnyAsync(b =>
            b.TableId == req.TableId &&
            b.Date.Date == req.Date.Date);

        if (conflict)
            return Conflict(new { message = "This table already has a booking on that date." });

        var booking = new Booking
        {
            RestaurantId  = req.RestaurantId,
            SectionId     = req.SectionId,
            TableId       = req.TableId,
            Date          = req.Date,
            EndTime       = req.Date.AddHours(1),
            CustomerEmail = req.CustomerEmail,
            Seats         = req.Seats,
            BookingRef    = OpenRestoApi.Core.Domain.BookingRefGenerator.Generate(),
        };

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, new BookingDetailDto
        {
            Id              = booking.Id,
            RestaurantId    = booking.RestaurantId,
            RestaurantName  = table.Section.Restaurant?.Name,
            SectionId       = booking.SectionId,
            SectionName     = table.Section.Name,
            TableId         = booking.TableId,
            TableName       = table.Name ?? $"Table {table.Id}",
            Date            = booking.Date,
            EndTime         = booking.EndTime,
            CustomerEmail   = booking.CustomerEmail,
            Seats           = booking.Seats,
            BookingRef      = booking.BookingRef,
        });
    }

    /// <summary>
    /// Partially update a booking — only supplied fields are changed.
    /// Supports: date/time, seats, table reassignment, guest email.
    /// </summary>
    [HttpPatch("bookings/{id}")]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingRequest req)
    {
        var booking = await _db.Bookings
            .Include(b => b.Restaurant)
            .Include(b => b.Section)
            .Include(b => b.Table)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (booking == null) return NotFound();

        if (req.Date.HasValue)
            booking.Date = req.Date.Value;

        if (req.Seats.HasValue)
            booking.Seats = req.Seats.Value;

        if (!string.IsNullOrEmpty(req.CustomerEmail))
            booking.CustomerEmail = req.CustomerEmail;

        // Table reassignment — validate the new table exists and is in the right section
        if (req.TableId.HasValue)
        {
            var sectionId = req.SectionId ?? booking.SectionId;
            var table = await _db.Tables
                .Include(t => t.Section)
                .FirstOrDefaultAsync(t => t.Id == req.TableId.Value && t.SectionId == sectionId);

            if (table == null)
                return BadRequest(new { message = "Table not found in the specified section." });

            booking.TableId   = table.Id;
            booking.SectionId = table.SectionId;
        }
        else if (req.SectionId.HasValue)
        {
            // Section changed but table not specified — reject ambiguous request
            return BadRequest(new { message = "Provide tableId when reassigning to a different section." });
        }

        await _db.SaveChangesAsync();

        return Ok(new BookingDetailDto
        {
            Id              = booking.Id,
            RestaurantId    = booking.RestaurantId,
            RestaurantName  = booking.Restaurant?.Name,
            SectionId       = booking.SectionId,
            SectionName     = booking.Section?.Name,
            TableId         = booking.TableId,
            TableName       = booking.Table?.Name ?? $"Table {booking.TableId}",
            Date            = booking.Date,
            EndTime         = booking.EndTime,
            CustomerEmail   = booking.CustomerEmail,
            Seats           = booking.Seats,
            SpecialRequests = booking.SpecialRequests,
            BookingRef      = booking.BookingRef,
        });
    }

    /// <summary>Extend a booking's end time by the given number of minutes.</summary>
    [HttpPost("bookings/{id}/extend")]
    public async Task<IActionResult> ExtendBooking(int id, [FromBody] ExtendBookingRequest req)
    {
        var booking = await _db.Bookings.FindAsync(id);
        if (booking == null) return NotFound();

        var from = booking.EndTime ?? booking.Date.AddHours(1);
        booking.EndTime = from.AddMinutes(req.Minutes);
        await _db.SaveChangesAsync();

        return Ok(new { endTime = booking.EndTime });
    }

    /// <summary>Soft-delete (cancel) a booking.</summary>
    [HttpDelete("bookings/{id}")]
    public async Task<IActionResult> CancelBooking(int id)
    {
        var booking = await _db.Bookings.FindAsync(id);
        if (booking == null) return NotFound();

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Restaurants ───────────────────────────────────────────────────────────

    /// <summary>Create a new restaurant location.</summary>
    [HttpPost("restaurants")]
    public async Task<IActionResult> CreateRestaurant([FromBody] CreateRestaurantRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        var restaurant = new Restaurant { Name = req.Name.Trim(), Address = req.Address?.Trim() };
        _db.Restaurants.Add(restaurant);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Overview), new { },
            new RestaurantDto
            {
                Id       = restaurant.Id,
                Name     = restaurant.Name,
                Address  = restaurant.Address,
                Sections = [],
            });
    }

    /// <summary>
    /// Permanently delete a restaurant, all its sections/tables, and all bookings
    /// associated with it. This action is irreversible.
    /// </summary>
    [HttpDelete("restaurants/{id}")]
    public async Task<IActionResult> DeleteRestaurant(int id)
    {
        var restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant == null) return NotFound();

        // Remove all bookings for this restaurant first (no cascade configured)
        var bookings = await _db.Bookings.Where(b => b.RestaurantId == id).ToListAsync();
        _db.Bookings.RemoveRange(bookings);

        // Sections and Tables are cascade-deleted by EF via the Restaurant
        _db.Restaurants.Remove(restaurant);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Tables ────────────────────────────────────────────────────────────────

    /// <summary>
    /// List all tables across a restaurant, optionally with current booking counts.
    /// Useful for the table configuration view.
    /// </summary>
    [HttpGet("restaurants/{restaurantId}/tables")]
    public async Task<IActionResult> GetTables(int restaurantId)
    {
        var sections = await _db.Sections
            .Where(s => s.RestaurantId == restaurantId)
            .Include(s => s.Tables)
            .OrderBy(s => s.Name)
            .ToListAsync();

        if (sections.Count == 0) return NotFound(new { message = "Restaurant not found or has no sections." });

        var result = sections.Select(s => new SectionDto
        {
            Id     = s.Id,
            Name   = s.Name,
            Tables = s.Tables.Select(t => new TableDto
            {
                Id    = t.Id,
                Name  = t.Name,
                Seats = t.Seats,
            }).ToList(),
        });

        return Ok(result);
    }
}
