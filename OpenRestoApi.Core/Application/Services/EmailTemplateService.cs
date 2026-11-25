using System.Net;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IEmailTemplateService" />
public sealed class EmailTemplateService : IEmailTemplateService
{
    // The en-dash (U+2013) is verbatim from the original inline subject and is deliberately not
    // a hyphen.
    public string BuildConfirmationSubject(Restaurant restaurant, string locale = "en") =>
        IsDutch(locale) ? $"Reservering bevestigd \u2013 {restaurant.Name}" : $"Booking confirmed \u2013 {restaurant.Name}";

    public string BuildConfirmationEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl, string locale = "en")
    {
        DateTime localDate = TimeZoneHelper.ConvertUtcToLocal(booking.Date, restaurant.Timezone);
        string dateStr = DateFormatter.FormatLongDate(localDate, locale);

        // EndTime is always set by CreateBookingAsync before this is called.
        DateTime localEndDate = TimeZoneHelper.ConvertUtcToLocal(booking.EndTime!.Value, restaurant.Timezone);
        string timeRangeStr = DateFormatter.FormatTimeRange(localDate, localEndDate, locale);

        string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
        string appName = brand.AppName ?? "Open Resto";
        string cleanWebsiteUrl = websiteUrl.TrimEnd('/');
        string lookupUrl = BookingLinks.Confirmation(cleanWebsiteUrl, booking);

        // Choose header: full-width banner for restaurant photos, small icon for brand SVG, plain text otherwise
        string headerHtml;
        if (!string.IsNullOrEmpty(restaurant.ImageUrl))
        {
            string imageSrc = restaurant.ImageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? restaurant.ImageUrl
                : $"{cleanWebsiteUrl}/{restaurant.ImageUrl.TrimStart('/')}";
            headerHtml = EmailTemplateBuilder.BannerHeader(imageSrc, restaurant.Name, restaurant.Name, L(locale, "Booking Confirmed", "Reservering bevestigd"));
        }
        else if (!string.IsNullOrEmpty(brand.FaviconIcon))
        {
            headerHtml = EmailTemplateBuilder.IconHeader(
                $"{cleanWebsiteUrl}/api/brand/pwa-icon.svg", appName, restaurant.Name, L(locale, "Booking Confirmed", "Reservering bevestigd"));
        }
        else
        {
            headerHtml = $"""
                <tr><td style="padding:40px 40px 24px;text-align:center;background-color:#ffffff;">
                  <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{WebUtility.HtmlEncode(restaurant.Name)}</h1>
                  <p style="margin:8px 0 0;font-size:16px;color:#6b7280;">{L(locale, "Booking Confirmed", "Reservering bevestigd")}</p>
                </td></tr>
                """;
        }

        string directionsHtml = string.IsNullOrWhiteSpace(restaurant.Address)
            ? ""
            : $"""
               <div style='margin-top:16px;padding-top:16px;border-top:1px solid #f0f0f0;'>
                 <p style='margin:0 0 8px;font-size:14px;color:#6b7280;'>{L(locale, "Location", "Adres")}</p>
                 <p style='margin:0 0 12px;font-size:15px;color:#111827;'>{WebUtility.HtmlEncode(restaurant.Address)}</p>
                 <a href='https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString(restaurant.Address)}'
                    style='color:{primaryColor};text-decoration:none;font-size:14px;font-weight:600;'>{L(locale, "Get directions", "Route bekijken")} &rarr;</a>
               </div>
               """;

        string sectionHtml = booking.Section != null
            ? $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;'>{L(locale, "Section", "Gedeelte")}</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(booking.Section.Name)}</td>
               </tr>
               """
            : "";

        string? tableLabel = booking.Table?.Name ?? (booking.TableId.HasValue ? $"{L(locale, "Table", "Tafel")} #{booking.TableId}" : null);
        // Combinable-table group booking: Table is null, so fall back to a readable group label so
        // the confirmation email still tells the diner what they reserved.
        tableLabel ??= booking.TableGroup is not null ? BookingMapper.GroupLabel(booking.TableGroup) : null;
        string tableHtml = tableLabel != null
            ? $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;'>{L(locale, "Table", "Tafel")}</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(tableLabel)}</td>
               </tr>
               """
            : "";

        string specialReqsHtml = string.IsNullOrWhiteSpace(booking.SpecialRequests)
            ? ""
            : $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;vertical-align:top;white-space:nowrap;'>{L(locale, "Special requests", "Bijzonderheden")}</td>
                 <td style='padding:12px 0 12px 16px;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(booking.SpecialRequests)}</td>
               </tr>
               """;

        string greetingName = string.IsNullOrWhiteSpace(booking.CustomerName)
            ? L(locale, "You're all set!", "Je reservering is geregeld!")
            : $"{L(locale, "You're all set,", "Gezellig dat je komt,")} {WebUtility.HtmlEncode(booking.CustomerName)}!";

        string contentHtml = $"""
            <!-- Confirmation Hero -->
            <tr><td style="padding:0 40px;">
              <div style="background-color:{primaryColor}10;border-radius:12px;padding:24px;text-align:center;border:1px solid {primaryColor}20;">
                <p style="margin:0;font-size:18px;font-weight:600;color:{primaryColor};">{greetingName}</p>
                <p style="margin:4px 0 0;font-size:14px;color:{primaryColor};opacity:0.8;">{L(locale, "We're looking forward to seeing you.", "We kijken ernaar uit je te zien.")}</p>
              </div>
            </td></tr>

            <!-- Details -->
            <tr><td style="padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;width:140px;">{L(locale, "Reference", "Reserveringscode")}</td>
                  <td style="padding:12px 0;font-size:14px;font-weight:700;color:#111827;letter-spacing:0.05em;">{WebUtility.HtmlEncode(booking.BookingRef ?? "")}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Date", "Datum")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Time", "Tijd")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{timeRangeStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Guests", "Gasten")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{booking.Seats} {(booking.Seats == 1 ? L(locale, "guest", "gast") : L(locale, "guests", "gasten"))}</td>
                </tr>
                {sectionHtml}
                {tableHtml}
                {specialReqsHtml}
              </table>
              {directionsHtml}
            </td></tr>

            <!-- CTA -->
            <tr><td style="padding:0 40px 32px;text-align:center;">
              <a href="{lookupUrl}" style="display:inline-block;background-color:{primaryColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">{L(locale, "Manage your booking", "Bekijk je reservering")}</a>
            </td></tr>

            <!-- Cancellation note -->
            <tr><td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">{L(locale, "Need to change or cancel your reservation?", "Wil je je reservering wijzigen of annuleren?")}<br>{L(locale, "Use the link above or visit our website.", "Gebruik de knop hierboven of ga naar onze website.")}</p>
            </td></tr>
            """;

        return EmailTemplateBuilder.Wrap(primaryColor, appName, cleanWebsiteUrl, headerHtml, contentHtml);
    }

    public string BuildRestaurantAlertSubject(Booking booking, Restaurant restaurant, RestaurantAlertKind kind, string locale = "en")
    {
        string guests = $"{booking.Seats} {(booking.Seats == 1 ? L(locale, "guest", "gast") : L(locale, "guests", "gasten"))}";
        string when = DateFormatter.FormatTime(TimeZoneHelper.ConvertUtcToLocal(booking.Date, restaurant.Timezone), locale);
        return kind == RestaurantAlertKind.Cancelled
            ? $"{L(locale, "Booking cancelled", "Reservering geannuleerd")} \u2013 {restaurant.Name}: {guests} {L(locale, "at", "om")} {when}"
            : $"{L(locale, "New booking", "Nieuwe reservering")} \u2013 {restaurant.Name}: {guests} {L(locale, "at", "om")} {when}";
    }

    /// <seealso>EmailTemplateServiceTests.BuildRestaurantAlertEmail_ListsTheBookingAndLinksToItInTheAdmin</seealso>
    /// <seealso>EmailTemplateServiceTests.BuildRestaurantAlertEmail_SaysCancelled_ForACancellation</seealso>
    public string BuildRestaurantAlertEmail(Booking booking, Restaurant restaurant, BrandSettings brand, string websiteUrl, RestaurantAlertKind kind, string locale = "en")
    {
        DateTime localDate = TimeZoneHelper.ConvertUtcToLocal(booking.Date, restaurant.Timezone);
        string dateStr = DateFormatter.FormatLongDate(localDate, locale);
        string timeStr = booking.EndTime is DateTime end
            ? DateFormatter.FormatTimeRange(localDate, TimeZoneHelper.ConvertUtcToLocal(end, restaurant.Timezone), locale)
            : DateFormatter.FormatTime(localDate, locale);

        string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
        string appName = brand.AppName ?? "Open Resto";
        string cleanWebsiteUrl = websiteUrl.TrimEnd('/');
        string adminUrl = $"{cleanWebsiteUrl}/admin/bookings?query={Uri.EscapeDataString(booking.BookingRef ?? "")}";

        bool cancelled = kind == RestaurantAlertKind.Cancelled;
        string headline = cancelled ? L(locale, "Booking cancelled", "Reservering geannuleerd") : L(locale, "New booking", "Nieuwe reservering");
        string lede = cancelled
            ? L(locale, "A guest has cancelled their booking. The table is free again.", "Een gast heeft de reservering geannuleerd. De tafel is weer beschikbaar.")
            : L(locale, "A guest has just booked a table online.", "Er is zojuist online een tafel gereserveerd.");

        string headerHtml = !string.IsNullOrEmpty(brand.FaviconIcon)
            ? EmailTemplateBuilder.IconHeader($"{cleanWebsiteUrl}/api/brand/pwa-icon.svg", appName, restaurant.Name, headline)
            : $"""
                <tr><td style="padding:40px 40px 24px;text-align:center;background-color:#ffffff;">
                  <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{WebUtility.HtmlEncode(restaurant.Name)}</h1>
                  <p style="margin:8px 0 0;font-size:16px;color:#6b7280;">{headline}</p>
                </td></tr>
                """;

        string guestName = string.IsNullOrWhiteSpace(booking.CustomerName) ? L(locale, "Guest", "Gast") : booking.CustomerName;
        string guestHtml = string.IsNullOrWhiteSpace(booking.CustomerEmail)
            ? WebUtility.HtmlEncode(guestName)
            : $"{WebUtility.HtmlEncode(guestName)}<br><span style='color:#6b7280;'>{WebUtility.HtmlEncode(booking.CustomerEmail)}</span>";

        string? tableLabel = booking.Table?.Name ?? (booking.TableId.HasValue ? $"{L(locale, "Table", "Tafel")} #{booking.TableId}" : null);
        tableLabel ??= booking.TableGroup is not null ? BookingMapper.GroupLabel(booking.TableGroup) : null;
        string seatingHtml = Row(L(locale, "Section", "Gedeelte"), booking.Section?.Name) + Row(L(locale, "Table", "Tafel"), tableLabel);
        string specialReqsHtml = Row(L(locale, "Special requests", "Bijzonderheden"), booking.SpecialRequests);

        string contentHtml = $"""
            <tr><td style="padding:0 40px;">
              <div style="background-color:{primaryColor}10;border-radius:12px;padding:24px;text-align:center;border:1px solid {primaryColor}20;">
                <p style="margin:0;font-size:18px;font-weight:600;color:{primaryColor};">{headline}</p>
                <p style="margin:4px 0 0;font-size:14px;color:{primaryColor};opacity:0.8;">{lede}</p>
              </div>
            </td></tr>

            <tr><td style="padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">{L(locale, "Guest", "Gast")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{guestHtml}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Party size", "Aantal gasten")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{booking.Seats} {(booking.Seats == 1 ? L(locale, "guest", "gast") : L(locale, "guests", "gasten"))}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Date", "Datum")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Time", "Tijd")}</td>
                  <td style="padding:12px 0;font-size:14px;color:#111827;">{timeStr}</td>
                </tr>
                {seatingHtml}
                <tr>
                  <td style="padding:12px 0;color:#6b7280;font-size:14px;">{L(locale, "Reference", "Reserveringscode")}</td>
                  <td style="padding:12px 0;font-size:14px;font-weight:700;color:#111827;letter-spacing:0.05em;">{WebUtility.HtmlEncode(booking.BookingRef ?? "")}</td>
                </tr>
                {specialReqsHtml}
              </table>
            </td></tr>

            <tr><td style="padding:0 40px 32px;text-align:center;">
              <a href="{adminUrl}" style="display:inline-block;background-color:{primaryColor};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">{L(locale, "Open in the admin", "Open in beheer")}</a>
            </td></tr>
            """;

        return EmailTemplateBuilder.Wrap(primaryColor, appName, cleanWebsiteUrl, headerHtml, contentHtml);
    }

    private static bool IsDutch(string? locale) => string.Equals(locale, "nl", StringComparison.OrdinalIgnoreCase);

    private static string L(string? locale, string english, string dutch) => IsDutch(locale) ? dutch : english;

    private static string Row(string label, string? value)
        => string.IsNullOrWhiteSpace(value)
            ? ""
            : $"""
               <tr>
                 <td style='padding:12px 0;color:#6b7280;font-size:14px;vertical-align:top;white-space:nowrap;'>{label}</td>
                 <td style='padding:12px 0;font-size:14px;color:#111827;'>{WebUtility.HtmlEncode(value)}</td>
               </tr>
               """;
}
