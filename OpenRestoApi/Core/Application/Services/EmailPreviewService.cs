using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// What a guest receives, rendered for the admin without sending anything. The point of it is
/// that it goes through the same <see cref="IEmailTemplateService"/> the send path does rather
/// than a second copy of the markup — a preview that mimicked the template would drift from it
/// silently, and the drift would only show up in a diner's inbox.
/// </summary>
public sealed class EmailPreviewService(
    IRestaurantRepository restaurants,
    BrandService brandService,
    IEmailTemplateService templateService,
    ISystemClock clock)
{
    private readonly IRestaurantRepository _restaurants = restaurants;
    private readonly BrandService _brandService = brandService;
    private readonly IEmailTemplateService _templateService = templateService;
    private readonly ISystemClock _clock = clock;

    /// <summary>
    /// Renders the confirmation for a stand-in booking at <paramref name="restaurantId"/>, or at
    /// the first location when none is named. Falls back to a placeholder location so an instance
    /// with nothing set up yet still previews its branding.
    /// </summary>
    public async Task<EmailPreviewResult> BuildConfirmationPreviewAsync(int? restaurantId)
    {
        List<Restaurant> active = await _restaurants.GetAllActiveWithSectionsAsync();
        Restaurant restaurant = active.FirstOrDefault(r => r.Id == restaurantId)
            ?? active.FirstOrDefault()
            ?? EmailPreviewSample.PlaceholderRestaurant;

        BrandSettings brand = await _brandService.GetAsync();
        string websiteUrl = _brandService.GetWebsiteUrl(brand);

        Booking booking = EmailPreviewSample.BookingFor(restaurant, _clock.UtcNow);

        return new EmailPreviewResult
        {
            RestaurantId = restaurant.Id == 0 ? null : restaurant.Id,
            RestaurantName = restaurant.Name,
            RecipientEmail = EmailPreviewSample.CustomerEmail,
            Subject = _templateService.BuildConfirmationSubject(restaurant),
            Html = _templateService.BuildConfirmationEmail(booking, restaurant, brand, websiteUrl),
        };
    }
}

public class EmailPreviewResult
{
    public int? RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Html { get; set; } = string.Empty;
}
