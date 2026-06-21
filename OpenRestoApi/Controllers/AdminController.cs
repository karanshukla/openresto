using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController(AdminService adminService, IEmailService emailService, BrandService? brandService = null) : ControllerBase
{
    public enum bookingStatus { active, cancelled, all, past, upcoming }
    private readonly AdminService _adminService = adminService;
    private readonly IEmailService _email = emailService;
    private readonly BrandService? _brand = brandService;

    [HttpGet("overview")]
    public async Task<IActionResult> Overview()
        => Ok(await _adminService.GetOverviewAsync());

    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings(
        [FromQuery] int? restaurantId,
        [FromQuery] DateTime? date,
        [FromQuery] bookingStatus status = bookingStatus.active,
        [FromQuery] bool cancelled = false,
        [FromQuery] string? email = null,
        [FromQuery] string? bookingRef = null)
    {
        //this is business logic that should likely belong in the service but its OK for now
        string effectiveStatus = cancelled ? nameof(bookingStatus.cancelled) : status.ToString();
        return Ok(await _adminService.GetBookingsAsync(restaurantId, date, effectiveStatus, email, bookingRef));
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

    [HttpPost("bookings/{id}/extend")]
    public async Task<IActionResult> ExtendBooking(int id, [FromBody] ExtendBookingRequest req)
    {
        DateTime? endTime = await _adminService.ExtendBookingAsync(id, req.Minutes);
        return endTime == null ? NotFound() : Ok(new { endTime });
    }

    [HttpPost("bookings/{id}/cancel")]
    public async Task<IActionResult> CancelBooking(int id)
        => await _adminService.CancelBookingAsync(id) ? NoContent() : NotFound();

    [HttpDelete("bookings/{id}")]
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

    [HttpPatch("restaurants/{id}")]
    public async Task<IActionResult> PatchRestaurant(int id, [FromBody] AdminRestaurantPatchRequest req)
    {
        if (req.IsArchived.HasValue)
        {
            bool success = await _adminService.SetArchivedAsync(id, req.IsArchived.Value);
            if (!success) return NotFound();
        }
        return NoContent();
    }

    [HttpDelete("restaurants/{id}")]
    public async Task<IActionResult> DeleteRestaurant(int id)
        => await _adminService.DeleteRestaurantAsync(id) ? NoContent() : NotFound();

    [HttpPost("restaurants/{id}/pause")]
    public async Task<IActionResult> PauseBookings(int id, [FromBody] PauseRestaurantRequest req)
    {
        bool success = await _adminService.PauseRestaurantBookingsAsync(id, req.Minutes);
        return success ? Ok(new MessageResponse { Message = "Bookings paused successfully." }) : NotFound();
    }

    [HttpPost("restaurants/{id}/unpause")]
    public async Task<IActionResult> UnpauseBookings(int id)
    {
        bool success = await _adminService.UnpauseRestaurantBookingsAsync(id);
        return success ? Ok(new MessageResponse { Message = "Bookings unpaused successfully." }) : NotFound();
    }

    [HttpPost("restaurants/{id}/extend")]
    public async Task<IActionResult> ExtendBookings(int id, [FromBody] ExtendRestaurantRequest req)
    {
        List<BookingDetailDto>? extendedBookings = await _adminService.ExtendAllActiveBookingsAsync(id, req.Minutes);
        return extendedBookings != null
            ? Ok(new { Message = "Bookings extended successfully.", ExtendedBookings = extendedBookings })
            : NotFound();
    }

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
            string htmlBody = req.Body;
            if (_brand != null && !req.Body.TrimStart().StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase)
                               && !req.Body.TrimStart().StartsWith("<html", StringComparison.OrdinalIgnoreCase))
            {
                var brand = await _brand.GetAsync();
                string appName = brand.AppName ?? "Open Resto";
                string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
                string websiteUrl = _brand.GetWebsiteUrl().TrimEnd('/');
                htmlBody = WrapInBrandedEmail(req.Body, appName, primaryColor, websiteUrl);
            }
            await _email.SendEmailAsync(booking.CustomerEmail, req.Subject, htmlBody);
            return Ok(new MessageResponse { Message = $"Email sent to {booking.CustomerEmail}." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new MessageResponse { Message = $"Failed to send: {ex.Message}" });
        }
        catch (Exception ex)
        {
            return BadRequest(new MessageResponse { Message = $"Failed to send: {ex.Message}" });
        }
    }

    private static string WrapInBrandedEmail(string content, string appName, string primaryColor, string websiteUrl)
    {
        bool isHtmlFragment = content.TrimStart().StartsWith('<');
        string innerHtml = isHtmlFragment
            ? content
            : System.Net.WebUtility.HtmlEncode(content).Replace("\n", "<br>").Replace("\r", "");

        return $"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
                <tr><td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
                    <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:3px solid {primaryColor};">
                      <h1 style="margin:0;font-size:20px;font-weight:700;color:{primaryColor};">{System.Net.WebUtility.HtmlEncode(appName)}</h1>
                    </td></tr>
                    <tr><td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#111827;">
                      {innerHtml}
                    </td></tr>
                    <tr><td style="padding:0 40px 32px;border-top:1px solid #f0f0f0;text-align:center;">
                      <p style="margin:24px 0 4px;font-size:13px;color:#6b7280;">
                        <a href="{websiteUrl}" style="color:{primaryColor};text-decoration:none;">{websiteUrl.Replace("http://","").Replace("https://","")}</a>
                      </p>
                      <p style="margin:0;font-size:12px;color:#9ca3af;">
                        &copy; {DateTime.UtcNow.Year} {System.Net.WebUtility.HtmlEncode(appName)}
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
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
