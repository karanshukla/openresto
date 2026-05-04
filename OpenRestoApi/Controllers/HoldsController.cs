using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("public")]
public class HoldsController(
    IHoldService holdService,
    IRestaurantRepository restaurantRepository,
    IBookingRepository bookingRepository) : ControllerBase
{
    private readonly IHoldService _holdService = holdService;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IBookingRepository _bookingRepository = bookingRepository;

    /// <summary>
    /// Places a temporary hold on a table for a given date.
    /// Returns 409 Conflict if the table is already held by someone else.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> PlaceHold([FromBody] PlaceHoldRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // 1. Fetch restaurant first to get its timezone
        var restaurant = await _restaurantRepository.GetByIdAsync(request.RestaurantId);
        if (restaurant == null)
        {
            return NotFound(new MessageResponse { Message = "Restaurant not found." });
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC
        DateTime bookingDate;
        if (request.Date.Kind == DateTimeKind.Unspecified)
        {
            TimeZoneInfo tz;
            try { tz = TimeZoneInfo.FindSystemTimeZoneById(restaurant.Timezone); }
            catch { tz = TimeZoneInfo.Utc; }
            bookingDate = TimeZoneInfo.ConvertTimeToUtc(request.Date, tz);
        }
        else
        {
            bookingDate = request.Date.ToUniversalTime();
        }

        // 3. Basic validation: date in future
        if (bookingDate < DateTime.UtcNow.AddMinutes(-5))
        {
            return BadRequest(new MessageResponse { Message = "Cannot hold a table for a past time." });
        }

        if (restaurant.BookingsPausedUntil.HasValue && restaurant.BookingsPausedUntil.Value > DateTime.UtcNow)
        {
            return BadRequest(new MessageResponse { Message = "Bookings are currently paused for this restaurant." });
        }

        // 4. Check operating hours and days
        if (!IsTimeWithinOpeningHours(restaurant, bookingDate))
        {
            return BadRequest(new MessageResponse { Message = "The restaurant is closed at the requested time." });
        }

        // 5. Check for existing booking in DB
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(request.TableId, bookingDate);
        if (alreadyBooked)
        {
            return Conflict(new MessageResponse { Message = "This table is already booked for that time." });
        }

        // 6. Place hold
        HoldResult? result = _holdService.PlaceHold(
            request.RestaurantId,
            request.TableId,
            request.SectionId,
            bookingDate);

        if (result == null)
        {
            return Conflict(new MessageResponse { Message = "This table is already held by another user. Please select a different table or try again shortly." });
        }

        return Ok(new HoldResponse
        {
            HoldId = result.HoldId,
            ExpiresAt = result.ExpiresAt
        });
    }

    private static bool IsTimeWithinOpeningHours(OpenRestoApi.Core.Domain.Restaurant restaurant, DateTime requestedUtc)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(restaurant.Timezone); }
        catch { tz = TimeZoneInfo.Utc; }

        DateTime localTime = TimeZoneInfo.ConvertTimeFromUtc(requestedUtc, tz);
        
        // Check OpenDays
        if (!string.IsNullOrEmpty(restaurant.OpenDays))
        {
            int isoDay = (int)localTime.DayOfWeek;
            if (isoDay == 0)
            {
                isoDay = 7; // Sunday: 0 -> 7
            }

            var openDaysList = restaurant.OpenDays.Split(',').Select(s => s.Trim());
            if (!openDaysList.Contains(isoDay.ToString(System.Globalization.CultureInfo.InvariantCulture)))
            {
                return false;
            }
        }

        if (!TryParseTime(restaurant.OpenTime, out int openHour, out int openMin))
        {
            openHour = 9; openMin = 0;
        }
        if (!TryParseTime(restaurant.CloseTime, out int closeHour, out int closeMin))
        {
            closeHour = 22; closeMin = 0;
        }

        TimeSpan open = new TimeSpan(openHour, openMin, 0);
        TimeSpan close = new TimeSpan(closeHour, closeMin, 0);
        TimeSpan current = localTime.TimeOfDay;

        if (close > open)
        {
            return current >= open && current < close;
        }
        else if (close < open)
        {
            // Closes after midnight (e.g. 18:00 to 02:00)
            return current >= open || current < close;
        }
        else
        {
            // close == open usually means 24h
            return true;
        }
    }

    private static bool TryParseTime(string time, out int h, out int m)
    {
        h = 0; m = 0;
        if (string.IsNullOrEmpty(time))
        {
            return false;
        }
        string[] parts = time.Split(':');
        if (parts.Length < 2)
        {
            return false;
        }
        return int.TryParse(parts[0], out h) && int.TryParse(parts[1], out m);
    }

    /// <summary>
    /// Releases a hold early (e.g., when the user navigates away).
    /// Safe to call even if the hold has already expired.
    /// </summary>
    [HttpDelete("{holdId}")]
    public IActionResult ReleaseHold(string holdId)
    {
        _holdService.ReleaseHold(holdId);
        return NoContent();
    }
}
