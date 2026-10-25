using Microsoft.Extensions.Logging;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IRestaurantBookingAlertService" />
/// <seealso>RestaurantBookingAlertServiceTests.SendBookingCreatedAsync_EmailsTheLocationsOwnAddress</seealso>
/// <seealso>RestaurantBookingAlertServiceTests.SendBookingCreatedAsync_FallsBackToTheBrandAddress</seealso>
/// <seealso>RestaurantBookingAlertServiceTests.SendBookingCreatedAsync_SendsNothing_WhenAlertsAreOff</seealso>
/// <seealso>RestaurantBookingAlertServiceTests.SendBookingCreatedAsync_SendsNothing_WhenNoAddressResolves</seealso>
/// <seealso>RestaurantBookingAlertServiceTests.SendBookingCreatedAsync_RecordsAFailure_WhenTheSendThrows</seealso>
public sealed class RestaurantBookingAlertService(
    EmailSettingsService emailSettingsService,
    IEmailService emailService,
    IEmailFailureRepository emailFailureRepository,
    IEmailTemplateService templateService,
    BrandService brandService,
    IRestaurantRepository restaurantRepository,
    IBookingRepository bookingRepository,
    ILogger<RestaurantBookingAlertService> logger) : IRestaurantBookingAlertService
{
    public Task SendBookingCreatedAsync(Booking booking)
        => SendAsync(booking, RestaurantAlertKind.Created);

    public Task SendBookingCancelledAsync(Booking booking)
        => SendAsync(booking, RestaurantAlertKind.Cancelled);

    private async Task SendAsync(Booking booking, RestaurantAlertKind kind)
    {
        string? recipient = null;
        try
        {
            EmailSettings? settings = await emailSettingsService.GetAsync();
            if (settings?.SendRestaurantBookingAlerts != true)
            {
                return;
            }

            // The worker runs after the request that took the booking has finished, so the
            // entity it was handed may carry no navigation properties; the stored row does.
            booking = await bookingRepository.GetByIdAsync(booking.Id) ?? booking;
            Restaurant? restaurant = booking.Restaurant ?? await restaurantRepository.GetByIdAsync(booking.RestaurantId);
            if (restaurant is null)
            {
                return;
            }

            BrandSettings brand = await brandService.GetAsync();
            recipient = RecipientFor(restaurant, brand);
            if (recipient is null)
            {
                logger.LogInformation("[Alert] No contact email for restaurant {RestaurantId}; booking alert for {Ref} skipped",
                    restaurant.Id, booking.BookingRef);
                return;
            }

            string websiteUrl = brandService.GetWebsiteUrl(brand);
            string subject = templateService.BuildRestaurantAlertSubject(booking, restaurant, kind);
            string body = templateService.BuildRestaurantAlertEmail(booking, restaurant, brand, websiteUrl, kind);
            await emailService.SendEmailAsync(recipient, subject, body);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Alert] Booking alert email failed for ref {Ref}", booking.BookingRef);
            await RecordFailureAsync(booking, recipient, ex);
        }
    }

    /// <summary>
    /// The location's own contact address, else the brand's, else nothing: the same per-field
    /// fallback the public site shows guests, so the address that answers "contact us" is the
    /// one that hears about bookings.
    /// </summary>
    private static string? RecipientFor(Restaurant restaurant, BrandSettings brand)
    {
        string? own = restaurant.EmailAddress?.Trim();
        if (!string.IsNullOrEmpty(own))
        {
            return own;
        }

        string? global = brand.EmailAddress?.Trim();
        return string.IsNullOrEmpty(global) ? null : global;
    }

    private async Task RecordFailureAsync(Booking booking, string? recipient, Exception ex)
    {
        try
        {
            await emailFailureRepository.AddAsync(new EmailFailure
            {
                BookingRef = booking.BookingRef,
                RecipientEmail = recipient ?? string.Empty,
                ErrorMessage = ex.Message,
                AttemptedAt = DateTime.UtcNow,
            });
        }
        catch (Exception recordEx)
        {
            logger.LogError(recordEx, "[Alert] Could not record the failed booking alert for ref {Ref}", booking.BookingRef);
        }
    }
}
