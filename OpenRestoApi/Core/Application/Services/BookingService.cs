using System.Globalization;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Core.Application.Services;

public class BookingService(
    IBookingRepository bookingRepository,
    ITableRepository tableRepository,
    ISectionRepository sectionRepository,
    IRestaurantRepository restaurantRepository,
    IHoldService holdService,
    BookingMapper mapper,
    BrandService brandService,
    EmailSettingsService? emailSettingsService = null,
    IEmailService? emailService = null,
    AppDbContext? db = null)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly IHoldService _holdService = holdService;
    private readonly BookingMapper _mapper = mapper;
    private readonly BrandService _brandService = brandService;
    private readonly EmailSettingsService? _emailSettingsService = emailSettingsService;
    private readonly IEmailService? _emailService = emailService;
    private readonly AppDbContext? _db = db;

    /// <summary>
    /// Creates a booking after validating:
    /// 1. No confirmed booking exists for the same table on the same date.
    /// 2. No other user holds the table for the same date (the submitter's own hold is excluded).
    /// If a holdId is provided and valid, it is released after the booking is persisted.
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when the table is unavailable.</exception>
    public virtual async Task<BookingDto> CreateBookingAsync(BookingDto bookingDto)
    {
        // 1. Validate restaurant-level pause first
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(bookingDto.RestaurantId);
        if (restaurant == null)
        {
            throw new ArgumentException("Restaurant not found.");
        }

        if (restaurant.BookingsPausedUntil.HasValue && restaurant.BookingsPausedUntil.Value > DateTime.UtcNow)
        {
            throw new InvalidOperationException("Bookings for this restaurant are currently paused. Please try again later.");
        }

        // 2. Normalize date: if Unspecified, treat as restaurant local and convert to UTC
        DateTime bookingDate;
        if (bookingDto.Date.Kind == DateTimeKind.Unspecified)
        {
            TimeZoneInfo tz;
            try { tz = TimeZoneInfo.FindSystemTimeZoneById(restaurant.Timezone); }
            catch { tz = TimeZoneInfo.Utc; }
            bookingDate = TimeZoneInfo.ConvertTimeToUtc(bookingDto.Date, tz);
        }
        else
        {
            bookingDate = bookingDto.Date.ToUniversalTime();
        }

        // 0. Reject bookings in the past
        if (bookingDate < DateTime.UtcNow.AddMinutes(-5))
        {
            throw new InvalidOperationException("Cannot create a booking in the past.");
        }

        if (bookingDto.TableId is null || bookingDto.SectionId is null)
            throw new ArgumentException("TableId and SectionId are required.");

        // 1. Check DB for an existing confirmed booking on the same table+date
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            bookingDto.TableId.Value, bookingDate);

        if (alreadyBooked)
        {
            throw new InvalidOperationException("This table is already booked for that time.");
        }

        // 2. Check for an active hold by someone else
        bool heldByOther = _holdService.IsTableHeld(
            bookingDto.TableId.Value, bookingDate, excludeHoldId: bookingDto.HoldId);

        if (heldByOther)
        {
            throw new InvalidOperationException("This table is currently being held by another user. Please try again shortly.");
        }

        // 3. Check for seat capacity
        Table? table = await _tableRepository.GetByIdAsync(bookingDto.TableId.Value);
        if (table != null && bookingDto.Seats > table.Seats)
        {
            throw new InvalidOperationException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
        }

        // 4. Persist the booking
        Booking booking = _mapper.ToEntity(bookingDto);
        booking.Date = bookingDate; // Use normalized date
        booking.BookingRef = BookingRefGenerator.Generate();
        booking.EndTime = bookingDate.AddHours(1);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(bookingDto.SectionId.Value))!;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        // 5. Release the hold now that the booking is confirmed
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        // 6. Send booking confirmation email (best-effort, never fails the booking)
        if (_emailSettingsService != null && _emailService != null && !string.IsNullOrEmpty(newBooking.CustomerEmail))
        {
            try
            {
                var settings = await _emailSettingsService.GetAsync();
                if (settings?.SendBookingConfirmations == true)
                {
                    var brand = await _brandService.GetAsync();
                    string websiteUrl = _brandService.GetWebsiteUrl();
                    string subject = $"Booking confirmed – {restaurant.Name}";
                    string body = BuildConfirmationEmail(newBooking, restaurant, brand, websiteUrl);
                    await _emailService.SendEmailAsync(newBooking.CustomerEmail, subject, body);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BookingService] Confirmation email failed for ref {newBooking.BookingRef}: {ex.Message}");
                if (_db != null)
                {
                    _db.EmailFailures.Add(new EmailFailure
                    {
                        BookingRef = newBooking.BookingRef,
                        RecipientEmail = newBooking.CustomerEmail,
                        ErrorMessage = ex.Message,
                        AttemptedAt = DateTime.UtcNow,
                    });
                    await _db.SaveChangesAsync();
                }
            }
        }

        return _mapper.ToDto(newBooking);
    }

    public virtual async Task<BookingDto?> GetBookingByIdAsync(int id)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public virtual async Task<BookingDto?> GetBookingByRefAsync(string bookingRef)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        return booking == null ? null : _mapper.ToDto(booking);
    }

    public virtual async Task<IEnumerable<BookingDto>> GetBookingsByRestaurantAsync(int restaurantId)
    {
        IEnumerable<Booking> bookings = await _bookingRepository.GetBookingsByRestaurantIdAsync(restaurantId);
        return _mapper.ToDtoList(bookings);
    }

    public virtual async Task UpdateBookingAsync(int id, BookingDto bookingDto)
    {
        _ = id; // Required by REST convention (PUT /bookings/{id}) but entity ID comes from DTO
        Booking booking = _mapper.ToEntity(bookingDto);

        // Check for seat capacity if seats are being updated
        if (bookingDto.Seats > 0)
        {
            Table? table = booking.TableId.HasValue ? await _tableRepository.GetByIdAsync(booking.TableId.Value) : null;
            if (table != null && bookingDto.Seats > table.Seats)
            {
                throw new InvalidOperationException($"This table only has {table.Seats} seats, but {bookingDto.Seats} guests were requested.");
            }
        }

        // Ensure EndTime is valid if it's being updated or if Date changed
        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }
        else if (!booking.EndTime.HasValue)
        {
            booking.EndTime = booking.Date.AddHours(1);
        }

        await _bookingRepository.UpdateAsync(booking);
    }

    public virtual async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }

    private static string BuildConfirmationEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(restaurant.Timezone); }
        catch { tz = TimeZoneInfo.Utc; }

        DateTime localDate = TimeZoneInfo.ConvertTimeFromUtc(booking.Date, tz);
        string dateStr = localDate.ToString("dddd, d MMMM yyyy", CultureInfo.InvariantCulture);
        string timeStr = localDate.ToString("h:mm tt", CultureInfo.InvariantCulture);

        string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
        string appName = brand.AppName ?? "Open Resto";
        string cleanWebsiteUrl = websiteUrl.TrimEnd('/');
        string lookupUrl = $"{cleanWebsiteUrl}/lookup";

        string headerImageHtml = string.IsNullOrEmpty(brand.HeaderImageUrl)
            ? ""
            : $"<img src='{brand.HeaderImageUrl}' alt='{appName}' style='max-height:48px;margin-bottom:16px;'>";

        string directionsHtml = string.IsNullOrWhiteSpace(restaurant.Address)
            ? ""
            : $"""
               <div style='margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;'>
                 <p style='margin:0 0 8px;font-size:14px;color:#6b7280;'>Location</p>
                 <p style='margin:0 0 12px;font-size:15px;color:#111827;'>{System.Net.WebUtility.HtmlEncode(restaurant.Address)}</p>
                 <a href='https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString(restaurant.Address)}' 
                    style='color:{primaryColor};text-decoration:none;font-size:14px;font-weight:600;'>Get directions &rarr;</a>
               </div>
               """;

        string specialReqsHtml = string.IsNullOrWhiteSpace(booking.SpecialRequests)
            ? ""
            : $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;vertical-align:top;'>Special requests</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{System.Net.WebUtility.HtmlEncode(booking.SpecialRequests)}</td>
               </tr>
               """;

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
                  <table width="100%" max-width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
                    <!-- Header -->
                    <tr><td style="padding:40px 40px 32px;text-align:center;background-color:#ffffff;">
                      {headerImageHtml}
                      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{System.Net.WebUtility.HtmlEncode(restaurant.Name)}</h1>
                      <p style="margin:8px 0 0;font-size:16px;color:#6b7280;">Booking Confirmed</p>
                    </td></tr>

                    <!-- Confirmation Hero -->
                    <tr><td style="padding:0 40px;">
                      <div style="background-color:{primaryColor}10;border-radius:12px;padding:24px;text-align:center;border:1px solid {primaryColor}20;">
                        <p style="margin:0;font-size:18px;font-weight:600;color:{primaryColor};">{(string.IsNullOrWhiteSpace(booking.CustomerName) ? "You're all set!" : $"You're all set, {System.Net.WebUtility.HtmlEncode(booking.CustomerName)}!")}</p>
                        <p style="margin:4px 0 0;font-size:14px;color:{primaryColor};opacity:0.8;">We're looking forward to seeing you.</p>
                      </div>
                    </td></tr>

                    <!-- Details -->
                    <tr><td style="padding:32px 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:12px 0;color:#6b7280;font-size:14px;width:100px;">Reference</td>
                          <td style="padding:12px 0;font-size:14px;font-weight:700;color:#111827;letter-spacing:0.05em;">{System.Net.WebUtility.HtmlEncode(booking.BookingRef ?? "")}</td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;color:#6b7280;font-size:14px;">Date</td>
                          <td style="padding:12px 0;font-size:14px;color:#111827;">{dateStr}</td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;color:#6b7280;font-size:14px;">Time</td>
                          <td style="padding:12px 0;font-size:14px;color:#111827;">{timeStr}</td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;color:#6b7280;font-size:14px;">Guests</td>
                          <td style="padding:12px 0;font-size:14px;color:#111827;">{booking.Seats} {(booking.Seats == 1 ? "guest" : "guests")}</td>
                        </tr>
                        {specialReqsHtml}
                      </table>

                      {directionsHtml}
                    </td></tr>

                    <!-- CTA -->
                    <tr><td style="padding:0 40px 32px;text-align:center;">
                      <a href="{lookupUrl}" style="display:inline-block;background-color:{primaryColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Manage your booking</a>
                      <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
                        Or visit: <a href="{cleanWebsiteUrl}" style="color:{primaryColor};text-decoration:none;">{cleanWebsiteUrl.Replace("http://", "").Replace("https://", "")}</a>
                      </p>
                    </td></tr>

                    <!-- Footer Info -->
                    <tr><td style="padding:0 40px 40px;">
                      <div style="padding-top:24px;border-top:1px solid #f0f0f0;text-align:center;">
                        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.5;">
                          Need to change or cancel your reservation?
                        </p>
                        <p style="margin:0;font-size:12px;color:#9ca3af;">
                          &copy; {DateTime.UtcNow.Year} {appName}
                        </p>
                      </div>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }

    public virtual async Task<bool> CancelBookingAsync(string bookingRef, string email)
    {
        Booking? booking = await _bookingRepository.GetByRefAsync(bookingRef);
        if (booking == null)
        {
            Console.WriteLine($"[CancelBookingAsync] Booking not found for ref: {bookingRef}");
            return false;
        }

        if (!string.Equals(booking.CustomerEmail?.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"[CancelBookingAsync] Email mismatch for ref: {bookingRef}. DB: {booking.CustomerEmail}, Input: {email}");
            return false;
        }

        if (booking.IsCancelled)
        {
            return true;
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _bookingRepository.UpdateAsync(booking);
        return true;
    }
}
