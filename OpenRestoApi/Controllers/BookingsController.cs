using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Cookies;

namespace OpenRestoApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("public")]
    public class BookingsController(BookingService bookingService, RecentBookingsCookie recentCookie) : ControllerBase
    {
        private readonly BookingService _bookingService = bookingService;
        private readonly RecentBookingsCookie _recentCookie = recentCookie;

        [HttpGet("/api/restaurants/{restaurantId}/bookings")]
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

            // ConflictException (overlap, paused, walk-in, past, held, seats) → 409 is mapped
            // by GlobalExceptionHandler with a MessageResponse { Message } body, which
            // serializes identically to the prior anonymous { message } shape.
            BookingDto newBooking = await _bookingService.CreateBookingAsync(bookingDto);

            string? restaurantName = await _bookingService.GetRestaurantNameAsync(bookingDto.RestaurantId);

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

        [HttpPost("ref/{bookingRef}/cancel")]
        public async Task<IActionResult> CancelBookingByRef(string bookingRef, [FromBody] CancelBookingByRefRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email))
            {
                return BadRequest(new { message = "Email is required to cancel a booking." });
            }

            // ConflictException (past booking) → 409 is mapped by GlobalExceptionHandler;
            // body serializes identically to the prior anonymous { message } shape.
            bool ok = await _bookingService.CancelBookingAsync(bookingRef, req.Email);
            if (!ok)
            {
                return NotFound(new { message = "No booking found matching that reference and email." });
            }
            return NoContent();
        }
    }
}
