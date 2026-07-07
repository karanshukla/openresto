using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IBookingConfirmationService" />
public sealed class BookingConfirmationService(
    EmailSettingsService? emailSettingsService,
    IEmailService? emailService,
    IEmailFailureRepository? emailFailureRepository,
    IEmailTemplateService templateService,
    BrandService brandService) : IBookingConfirmationService
{
    private readonly EmailSettingsService? _emailSettingsService = emailSettingsService;
    private readonly IEmailService? _emailService = emailService;
    private readonly IEmailFailureRepository? _emailFailureRepository = emailFailureRepository;
    private readonly IEmailTemplateService _templateService = templateService;
    private readonly BrandService _brandService = brandService;

    public async Task SendConfirmationAsync(Booking booking, Restaurant restaurant)
    {
        // Same null-guard chain as the original BookingService block: short-circuits when any
        // prerequisite is missing so booking creation is never blocked by email configuration.
        if (_emailSettingsService == null || _emailService == null || string.IsNullOrEmpty(booking.CustomerEmail))
        {
            return;
        }

        try
        {
            var settings = await _emailSettingsService.GetAsync();
            if (settings?.SendBookingConfirmations != true)
            {
                return;
            }

            var brand = await _brandService.GetAsync();
            string websiteUrl = _brandService.GetWebsiteUrl(brand);
            // Subject uses an en-dash (U+2013), not a hyphen — preserved verbatim from the original.
            string subject = $"Booking confirmed – {restaurant.Name}";
            string body = _templateService.BuildConfirmationEmail(booking, restaurant, brand, websiteUrl);
            await _emailService.SendEmailAsync(booking.CustomerEmail, subject, body);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[BookingConfirmationService] Confirmation email failed for ref {booking.BookingRef}: {ex.Message}");
            if (_emailFailureRepository != null)
            {
                await _emailFailureRepository.AddAsync(new EmailFailure
                {
                    BookingRef = booking.BookingRef,
                    RecipientEmail = booking.CustomerEmail,
                    ErrorMessage = ex.Message,
                    AttemptedAt = DateTime.UtcNow,
                });
            }
        }
    }
}
