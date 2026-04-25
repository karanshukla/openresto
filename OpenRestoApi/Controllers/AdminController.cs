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
    public enum bookingStatus { active, cancelled, all, past, upcoming }
    private readonly AdminService _adminService = adminService;
    private readonly IEmailService _email = emailService;

    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
        => Ok(await _adminService.GetOverviewAsync());

    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings(
        [FromQuery] int? restaurantId,
        [FromQuery] DateTime? date,
        [FromQuery] bookingStatus status = bookingStatus.active,
        [FromQuery] bool cancelled = false)
    {
        //this is business logic that should likely belong in the service but its OK for now
        string effectiveStatus = cancelled ? nameof(bookingStatus.cancelled) : status.ToString();
        return Ok(await _adminService.GetBookingsAsync(restaurantId, date, effectiveStatus));
    }

    [HttpGet("bookings/{id}")]
    public async Task<IActionResult> GetBooking(int id)
    {
        BookingDetailDto? result = await _adminService.GetBookingAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] AdminCreateBookingRequest req)
    {
        try
        {
            BookingDetailDto result = await _adminService.CreateBookingAsync(req);
            return CreatedAtAction(nameof(GetBooking), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new MessageResponse { Message = ex.Message });
        }
    }

    [HttpPatch("bookings/{id}")]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingRequest req)
    {
        try
        {
            BookingDetailDto? result = await _adminService.UpdateBookingAsync(id, req);
            return result == null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
    }

    [HttpPost("bookings/{id}/extend")]
    public async Task<IActionResult> ExtendBooking(int id, [FromBody] ExtendBookingRequest req)
    {
        DateTime? endTime = await _adminService.ExtendBookingAsync(id, req.Minutes);
        return endTime == null ? NotFound() : Ok(new { endTime });
    }

    [HttpDelete("bookings/{id}")]
    public async Task<IActionResult> CancelBooking(int id)
        => await _adminService.CancelBookingAsync(id) ? NoContent() : NotFound();

    [HttpDelete("bookings/{id}/purge")]
    public async Task<IActionResult> PurgeBooking(int id)
        => await _adminService.PurgeBookingAsync(id) ? NoContent() : NotFound();

    [HttpPost("restaurants")]
    public async Task<IActionResult> CreateRestaurant([FromBody] CreateRestaurantRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new MessageResponse { Message = "Name is required." });
        }

        RestaurantDto result = await _adminService.CreateRestaurantAsync(req.Name, req.Address);
        return CreatedAtAction(nameof(Overview), new { }, result);
    }

    [HttpDelete("restaurants/{id}")]
    public async Task<IActionResult> DeleteRestaurant(int id)
        => await _adminService.DeleteRestaurantAsync(id) ? NoContent() : NotFound();

    [HttpGet("restaurants")]
    public async Task<IActionResult> GetRestaurants()
    {
        List<LookupDto> restaurants = await _adminService.GetRestaurantsAsync();
        return Ok(restaurants);
    }

    [HttpGet("restaurants/{restaurantId}/sections")]
    public async Task<IActionResult> GetSections(int restaurantId)
    {
        List<LookupDto> sections = await _adminService.GetSectionsAsync(restaurantId);
        return Ok(sections);
    }

    [HttpGet("restaurants/{restaurantId}/tables")]
    public async Task<IActionResult> GetTables(int restaurantId)
    {
        List<SectionDto>? result = await _adminService.GetTablesAsync(restaurantId);
        return result == null
            ? NotFound(new MessageResponse { Message = "Restaurant not found or has no sections." })
            : Ok(result);
    }

    [HttpPost("bookings/{id}/email")]
    public async Task<IActionResult> SendEmail(int id, [FromBody] SendBookingEmailRequest req)
    {
        BookingDetailDto? booking = await _adminService.GetBookingAsync(id);
        if (booking == null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(req.Subject) || string.IsNullOrWhiteSpace(req.Body))
        {
            return BadRequest(new MessageResponse { Message = "Subject and body are required." });
        }

        if (string.IsNullOrWhiteSpace(booking.CustomerEmail))
        {
            return BadRequest(new MessageResponse { Message = "Customer email is not available." });
        }

        try
        {
            await _email.SendEmailAsync(booking.CustomerEmail, req.Subject, req.Body);
            return Ok(new MessageResponse { Message = $"Email sent to {booking.CustomerEmail}." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new MessageResponse { Message = $"Failed to send: {ex.Message}" });
        }
    }

    [HttpPost("bookings/{id}/restore")]
    public async Task<IActionResult> RestoreBooking(int id)
    {
        try
        {
            BookingDetailDto? result = await _adminService.RestoreBookingAsync(id);
            return result == null ? NotFound() : Ok(new MessageResponse { Message = "Booking restored successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
    }

    [HttpPut("bookings/{id}")]
    public async Task<IActionResult> AdminUpdateBooking(int id, [FromBody] AdminUpdateBookingRequest req)
    {
        try
        {
            BookingDetailDto? result = await _adminService.AdminUpdateBookingAsync(id, req);
            return result == null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new MessageResponse { Message = ex.Message });
        }
    }
}
