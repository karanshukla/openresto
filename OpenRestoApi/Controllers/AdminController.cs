using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController(AdminService adminService, IEmailService emailService) : ControllerBase
{
    private readonly AdminService _admin = adminService;
    private readonly IEmailService _email = emailService;

    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
        => Ok(await _admin.GetOverviewAsync());

    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings(
        [FromQuery] int? restaurantId,
        [FromQuery] DateTime? date,
        [FromQuery] string status = "active",
        [FromQuery] bool cancelled = false)
    {
        string effectiveStatus = cancelled ? "cancelled" : status;
        return Ok(await _admin.GetBookingsAsync(restaurantId, date, effectiveStatus));
    }

    [HttpGet("bookings/{id}")]
    public async Task<IActionResult> GetBooking(int id)
    {
        BookingDetailDto? result = await _admin.GetBookingAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] AdminCreateBookingRequest req)
    {
        try
        {
            BookingDetailDto result = await _admin.CreateBookingAsync(req);
            return CreatedAtAction(nameof(GetBooking), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPatch("bookings/{id}")]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingRequest req)
    {
        try
        {
            BookingDetailDto? result = await _admin.UpdateBookingAsync(id, req);
            return result == null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("bookings/{id}/extend")]
    public async Task<IActionResult> ExtendBooking(int id, [FromBody] ExtendBookingRequest req)
    {
        DateTime? endTime = await _admin.ExtendBookingAsync(id, req.Minutes);
        return endTime == null ? NotFound() : Ok(new { endTime });
    }

    [HttpDelete("bookings/{id}")]
    public async Task<IActionResult> CancelBooking(int id)
        => await _admin.CancelBookingAsync(id) ? NoContent() : NotFound();

    [HttpDelete("bookings/{id}/purge")]
    public async Task<IActionResult> PurgeBooking(int id)
        => await _admin.PurgeBookingAsync(id) ? NoContent() : NotFound();

    [HttpPost("restaurants")]
    public async Task<IActionResult> CreateRestaurant([FromBody] CreateRestaurantRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        RestaurantDto result = await _admin.CreateRestaurantAsync(req.Name, req.Address);
        return CreatedAtAction(nameof(Overview), new { }, result);
    }

    [HttpDelete("restaurants/{id}")]
    public async Task<IActionResult> DeleteRestaurant(int id)
        => await _admin.DeleteRestaurantAsync(id) ? NoContent() : NotFound();

    [HttpGet("restaurants/{restaurantId}/tables")]
    public async Task<IActionResult> GetTables(int restaurantId)
    {
        List<SectionDto>? result = await _admin.GetTablesAsync(restaurantId);
        return result == null
            ? NotFound(new { message = "Restaurant not found or has no sections." })
            : Ok(result);
    }

    [HttpPost("bookings/{id}/email")]
    public async Task<IActionResult> SendEmail(int id, [FromBody] SendBookingEmailRequest req)
    {
        BookingDetailDto? booking = await _admin.GetBookingAsync(id);
        if (booking == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(req.Subject) || string.IsNullOrWhiteSpace(req.Body))
        {
            return BadRequest(new { message = "Subject and body are required." });
        }

        if (string.IsNullOrWhiteSpace(booking.CustomerEmail))
        {
            return BadRequest(new { message = "Customer email is not available." });
        }

        try
        {
            await _email.SendEmailAsync(booking.CustomerEmail, req.Subject, req.Body);
            return Ok(new { message = $"Email sent to {booking.CustomerEmail}." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Failed to send: {ex.Message}" });
        }
    }
}
