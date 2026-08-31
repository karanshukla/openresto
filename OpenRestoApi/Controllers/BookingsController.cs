using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Extensions;
using OpenRestoApi.Infrastructure.Auth;
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
        [Authorize(Policy = AuthPolicies.RequireAdmin)]
        [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read)]
        public async Task<IActionResult> GetBookings(int restaurantId)
        {
            IEnumerable<BookingDto> bookings = await _bookingService.GetBookingsByRestaurantAsync(restaurantId);
            return Ok(bookings);
        }

        [HttpGet("{id}")]
        [Authorize(Policy = AuthPolicies.RequireAdmin)]
        [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read)]
        public async Task<IActionResult> GetBooking(int id)
        {
            BookingDto? booking = await _bookingService.GetBookingByIdAsync(id);
            if (booking == null)
            {
                return NotFound();
            }
            return Ok(booking);
        }

        // A reference plus the email on the booking is the whole of a guest's identity — there is
        // no account behind it — so this and CancelBookingByRef are the two endpoints where a
        // guessed reference is worth guessing, and they take the tight booking-lookup ceiling
        // rather than the controller's "public" one. The reference's own width is the defence
        // that survives an attacker with a pool of addresses; see BookingRefGenerator.
        //
        // The 404 is deliberately identical for an unknown reference and for a known reference
        // with the wrong email: telling those apart would let an attacker confirm references
        // without knowing any email at all, turning a two-part secret into a one-part one.
        //
        // Plain comments, not a doc comment: a <summary> on a public action is copied into the
        // generated OpenAPI contract, and the CLI's committed copy of it must match byte for byte.
        // <seealso>BookingsControllerTests.GetBookingByRef_UnknownRefAndWrongEmailAreIndistinguishable</seealso>
        // <seealso>BookingRefEndpointRateLimitTests.ByRefGuestActions_CarryTheTightLookupPolicy</seealso>
        [HttpGet("ref/{bookingRef}")]
        [EnableRateLimiting(ServiceCollectionExtensions.BookingLookupPolicy)]
        public async Task<IActionResult> GetBookingByRef(string bookingRef, [FromQuery] string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new MessageResponse { Message = "Email is required to look up a booking.", Code = ErrorCodes.BookingLookupEmailRequired });
            }

            BookingDto? booking = await _bookingService.GetBookingByRefAsync(bookingRef);
            if (booking == null || !string.Equals(booking.CustomerEmail, email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return NotFound(new MessageResponse { Message = "No booking found matching that reference and email.", Code = ErrorCodes.BookingLookupNotFound });
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
        [Authorize(Policy = AuthPolicies.RequireAdmin)]
        [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
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
        [Authorize(Policy = AuthPolicies.RequireAdmin)]
        [RequiresScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
        public async Task<IActionResult> DeleteBooking(int id)
        {
            await _bookingService.DeleteBookingAsync(id);
            return NoContent();
        }

        // Same two-part guest secret, same identical-404, and the same tight ceiling as
        // GetBookingByRef — see there.
        // <seealso>BookingsControllerTests.CancelBookingByRef_UnknownRefAndWrongEmailAreIndistinguishable</seealso>
        // <seealso>BookingRefEndpointRateLimitTests.ByRefGuestActions_CarryTheTightLookupPolicy</seealso>
        [HttpPost("ref/{bookingRef}/cancel")]
        [EnableRateLimiting(ServiceCollectionExtensions.BookingLookupPolicy)]
        public async Task<IActionResult> CancelBookingByRef(string bookingRef, [FromBody] CancelBookingByRefRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email))
            {
                return BadRequest(new MessageResponse { Message = "Email is required to cancel a booking.", Code = ErrorCodes.BookingCancelEmailRequired });
            }

            // ConflictException (past booking) → 409 is mapped by GlobalExceptionHandler;
            // body serializes identically to the prior anonymous { message } shape.
            bool ok = await _bookingService.CancelBookingAsync(bookingRef, req.Email);
            if (!ok)
            {
                return NotFound(new MessageResponse { Message = "No booking found matching that reference and email.", Code = ErrorCodes.BookingLookupNotFound });
            }
            return NoContent();
        }
    }
}
