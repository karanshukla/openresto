using System.Net;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;
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
    AppDbContext? db = null,
    INotificationQueue? notificationQueue = null)
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
    private readonly INotificationQueue? _notificationQueue = notificationQueue;

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
        DateTime bookingDate = TimeZoneHelper.ConvertLocalToUtc(bookingDto.Date, restaurant.Timezone);

        // 0. Reject bookings in the past
        if (bookingDate < DateTime.UtcNow.AddMinutes(-5))
        {
            throw new InvalidOperationException("Cannot create a booking in the past.");
        }

        // Walk-in-only locations (or walk-in-only days) never take online bookings.
        // Admin-recorded bookings use AdminService.CreateBookingAsync and are unaffected.
        if (WalkInHelper.IsWalkInOnlyAt(restaurant, bookingDate))
        {
            throw new InvalidOperationException(restaurant.WalkInOnly
                ? "This location accepts walk-ins only and does not take online bookings."
                : "This location accepts walk-ins only on the selected day. Please choose another day or just come in.");
        }

        if (bookingDto.TableId is null || bookingDto.SectionId is null)
            throw new ArgumentException("TableId and SectionId are required.");

        // 1. Check DB for an existing confirmed booking on the same table+date
        bool alreadyBooked = await _bookingRepository.IsTableBookedOnDateAsync(
            bookingDto.TableId.Value, bookingDate, restaurant.DefaultBookingDurationMinutes);

        if (alreadyBooked)
        {
            throw new InvalidOperationException("This table is already booked for that time.");
        }

        // 2. Check for an active hold by someone else
        bool heldByOther = _holdService.IsTableHeld(
            bookingDto.TableId.Value, bookingDate, excludeHoldId: bookingDto.HoldId,
            durationMinutes: restaurant.DefaultBookingDurationMinutes);

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
        booking.EndTime = bookingDate.AddMinutes(restaurant.DefaultBookingDurationMinutes);
        booking.Table = table!;
        booking.Section = (await _sectionRepository.GetByIdAsync(bookingDto.SectionId.Value))!;
        booking.Restaurant = restaurant;

        Booking newBooking = await _bookingRepository.AddAsync(booking);

        // 5. Release the hold now that the booking is confirmed
        if (!string.IsNullOrEmpty(bookingDto.HoldId))
        {
            _holdService.ReleaseHold(bookingDto.HoldId);
        }

        // 6. Admin push notification (fire-and-forget via background queue)
        if (_notificationQueue != null)
        {
            _notificationQueue.EnqueueBookingCreated(newBooking, restaurant.Name);
            _notificationQueue.EnqueueCapacityCheck(restaurant.Id, restaurant.Name, newBooking.Date);
        }

        // 7. Send booking confirmation email (best-effort, never fails the booking)
        if (_emailSettingsService != null && _emailService != null && !string.IsNullOrEmpty(newBooking.CustomerEmail))
        {
            try
            {
                var settings = await _emailSettingsService.GetAsync();
                if (settings?.SendBookingConfirmations == true)
                {
                    var brand = await _brandService.GetAsync();
                    string websiteUrl = _brandService.GetWebsiteUrl(brand);
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
        if (!booking.EndTime.HasValue || booking.EndTime.Value < booking.Date)
        {
            Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);
            booking.EndTime = booking.Date.AddMinutes(restaurant?.DefaultBookingDurationMinutes ?? 60);
        }

        await _bookingRepository.UpdateAsync(booking);
    }

    public virtual async Task DeleteBookingAsync(int id)
    {
        await _bookingRepository.DeleteAsync(id);
    }

    private static string BuildConfirmationEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl)
    {
        DateTime localDate = TimeZoneHelper.ConvertUtcToLocal(booking.Date, restaurant.Timezone);
        string dateStr = DateFormatter.FormatLongDate(localDate);

        // EndTime is always set by CreateBookingAsync before this is called.
        DateTime localEndDate = TimeZoneHelper.ConvertUtcToLocal(booking.EndTime!.Value, restaurant.Timezone);
        string timeRangeStr = DateFormatter.FormatTimeRange(localDate, localEndDate);

        string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
        string appName = brand.AppName ?? "Open Resto";
        string cleanWebsiteUrl = websiteUrl.TrimEnd('/');
        string lookupUrl = $"{cleanWebsiteUrl}/booking-confirmation/{Uri.EscapeDataString(booking.BookingRef ?? "")}?email={Uri.EscapeDataString(booking.CustomerEmail ?? "")}";

        // Choose header: full-width banner for restaurant photos, small icon for brand SVG, plain text otherwise
        string headerHtml;
        if (!string.IsNullOrEmpty(restaurant.ImageUrl))
        {
            string imageSrc = restaurant.ImageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? restaurant.ImageUrl
                : $"{cleanWebsiteUrl}/{restaurant.ImageUrl.TrimStart('/')}";
            headerHtml = EmailTemplateBuilder.BannerHeader(imageSrc, restaurant.Name, restaurant.Name, "Booking Confirmed");
        }
        else if (!string.IsNullOrEmpty(brand.FaviconIcon))
        {
            headerHtml = EmailTemplateBuilder.IconHeader(
                $"{cleanWebsiteUrl}/api/brand/pwa-icon.svg", appName, restaurant.Name, "Booking Confirmed");
        }
        else
        {
            headerHtml = $"""
                <tr><td style="padding:40px 40px 24px;text-align:center;background-color:#ffffff;">
                  <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{WebUtility.HtmlEncode(restaurant.Name)}</h1>
                  <p style="margin:8px 0 0;font-size:16px;color:#6b7280;">Booking Confirmed</p>
                </td></tr>
                """;
        }

        string directionsHtml = string.IsNullOrWhiteSpace(restaurant.Address)
            ? ""
            : $"""
               <div style='margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;'>
                 <p style='margin:0 0 8px;font-size:14px;color:#6b7280;'>Location</p>
                 <p style='margin:0 0 12px;font-size:15px;color:#111827;'>{WebUtility.HtmlEncode(restaurant.Address)}</p>
                 <a href='https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString(restaurant.Address)}'
                    style='color:{primaryColor};text-decoration:none;font-size:14px;font-weight:600;'>Get directions &rarr;</a>
               </div>
               """;

        string sectionHtml = booking.Section != null
            ? $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;'>Section</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(booking.Section.Name)}</td>
               </tr>
               """
            : "";

        string tableLabel = booking.Table?.Name ?? (booking.TableId.HasValue ? $"Table #{booking.TableId}" : null);
        string tableHtml = tableLabel != null
            ? $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;'>Table</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(tableLabel)}</td>
               </tr>
               """
            : "";

        string specialReqsHtml = string.IsNullOrWhiteSpace(booking.SpecialRequests)
            ? ""
            : $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;vertical-align:top;white-space:nowrap;'>Special requests</td>
                 <td style='padding:12px 0 12px 16px;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(booking.SpecialRequests)}</td>
               </tr>
               """;

        string greetingName = string.IsNullOrWhiteSpace(booking.CustomerName)
            ? "You're all set!"
            : $"You're all set, {WebUtility.HtmlEncode(booking.CustomerName)}!";

        string contentHtml = $"""
            <!-- Confirmation Hero -->
            <tr><td style="padding:0 40px;">
              <div style="background-color:{primaryColor}10;border-radius:12px;padding:24px;text-align:center;border:1px solid {primaryColor}20;">
                <p style="margin:0;font-size:18px;font-weight:600;color:{primaryColor};">{greetingName}</p>
                <p style="margin:4px 0 0;font-size:14px;color:{primaryColor};opacity:0.8;">We're looking forward to seeing you.</p>
              </div>
            </td></tr>

            <!-- Details -->
            <tr><td style="padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;width:140px;">Reference</td>
                  <td style="padding:12px 0;font-size:14px;font-weight:700;color:#111827;letter-spacing:0.05em;">{WebUtility.HtmlEncode(booking.BookingRef ?? "")}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">Date</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">Time</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{timeRangeStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">Guests</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{booking.Seats} {(booking.Seats == 1 ? "guest" : "guests")}</td>
                </tr>
                {sectionHtml}
                {tableHtml}
                {specialReqsHtml}
              </table>
              {directionsHtml}
            </td></tr>

            <!-- CTA -->
            <tr><td style="padding:0 40px 32px;text-align:center;">
              <a href="{lookupUrl}" style="display:inline-block;background-color:{primaryColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Manage your booking</a>
            </td></tr>

            <!-- Cancellation note -->
            <tr><td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">Need to change or cancel your reservation?<br>Use the link above or visit our website.</p>
            </td></tr>
            """;

        return EmailTemplateBuilder.Wrap(primaryColor, appName, cleanWebsiteUrl, headerHtml, contentHtml);
    }

    public virtual async Task<string?> GetRestaurantNameAsync(int restaurantId)
    {
        Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(restaurantId);
        return restaurant?.Name;
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

        if (booking.Date < DateTime.UtcNow.AddMinutes(-5))
        {
            throw new InvalidOperationException("Cannot cancel a booking that has already passed.");
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _bookingRepository.UpdateAsync(booking);

        if (_notificationQueue != null)
        {
            Restaurant? restaurant = await _restaurantRepository.GetByIdAsync(booking.RestaurantId);
            _notificationQueue.EnqueueBookingCancelled(booking, restaurant?.Name ?? "");
        }

        return true;
    }
}
