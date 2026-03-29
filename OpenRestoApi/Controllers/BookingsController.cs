using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Cookies;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("public")]
    public class BookingsController(BookingService bookingService, RecentBookingsCookie recentCookie, AppDbContext db) : ControllerBase
    {
        private readonly BookingService _bookingService = bookingService;
        private readonly RecentBookingsCookie _recentCookie = recentCookie;
        private readonly AppDbContext _db = db;

        [HttpGet("restaurant/{restaurantId}")]
        [Authorize]
        public async Task<IActionResult> GetBookings(int restaurantId)
        {
            IEnumerable<BookingDto> bookings = await _bookingService.GetBookingsByRestaurantAsync(restaurantId);
            return Ok(bookings);
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<IActionResult> GetBooking(int id)
        {
            BookingDto? booking = await _bookingService.GetBookingByIdAsync(id);
            if (booking == null)
            {
                return NotFound();
            }
            return Ok(booking);
        }

        [HttpGet("ref/{bookingRef}")]
        public async Task<IActionResult> GetBookingByRef(string bookingRef, [FromQuery] string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "Email is required to look up a booking." });
            }

            BookingDto? booking = await _bookingService.GetBookingByRefAsync(bookingRef);
            if (booking == null || !string.Equals(booking.CustomerEmail, email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return NotFound(new { message = "No booking found matching that reference and email." });
            }
            return Ok(booking);
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] BookingDto bookingDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                BookingDto newBooking = await _bookingService.CreateBookingAsync(bookingDto);

                // Append to the encrypted recent-bookings cookie
                string? restaurantName = await _db.Restaurants
                    .Where(r => r.Id == bookingDto.RestaurantId)
                    .Select(r => r.Name)
                    .FirstOrDefaultAsync();

                _recentCookie.Append(Request, Response, new CachedBookingEntry(
                    BookingRef: newBooking.BookingRef ?? "",
                    Email: newBooking.CustomerEmail ?? "",
                    Date: newBooking.Date.ToString("O"),
                    Seats: newBooking.Seats,
                    RestaurantName: restaurantName,
                    CreatedAt: DateTime.UtcNow.ToString("O")
                ));

                return CreatedAtAction(nameof(GetBooking), new { id = newBooking.Id }, newBooking);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>Returns the user's recent bookings from their encrypted HttpOnly cookie.</summary>
        [HttpGet("my-recent")]
        public IActionResult GetMyRecentBookings()
        {
            List<CachedBookingEntry> entries = _recentCookie.Read(Request);
            return Ok(entries);
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateBooking(int id, [FromBody] BookingDto bookingDto)
        {
            if (id != bookingDto.Id)
            {
                return BadRequest();
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            await _bookingService.UpdateBookingAsync(id, bookingDto);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteBooking(int id)
        {
            await _bookingService.DeleteBookingAsync(id);
            return NoContent();
        }

        [HttpDelete("ref/{bookingRef}")]
        public async Task<IActionResult> CancelBookingByRef(string bookingRef, [FromQuery] string email)
        {
            Console.WriteLine($"[CancelBookingByRef] Received request for ref: {bookingRef}, email: {email}");
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "Email is required to cancel a booking." });
            }

            bool ok = await _bookingService.CancelBookingAsync(bookingRef, email);
            if (!ok)
            {
                return NotFound(new { message = "No booking found matching that reference and email." });
            }
            return NoContent();
        }
    }
}
