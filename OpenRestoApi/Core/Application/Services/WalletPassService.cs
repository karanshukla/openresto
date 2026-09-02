using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Wallet;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Turns a booking into a wallet pass. Ownership is the reference-plus-email pair, and a miss
/// answers null (the controller's identical 404) for the reason <c>BookingsController.GetBookingByRef</c>
/// gives. A cancelled booking gets no pass: Wallet has no way to learn it was cancelled later, so
/// the pass would sit on the phone claiming a table that is not held.
/// </summary>
public class WalletPassService(
    IBookingRepository bookingRepository,
    IWalletCredentials credentials,
    BrandService brandService,
    ISystemClock clock)
{
    private const string DefaultPrimaryColor = "#0a7ea4";

    public WalletAvailabilityResponse Availability() => new()
    {
        Apple = credentials.Apple is not null,
        Google = credentials.Google is not null,
    };

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>WalletPassServiceTests.BuildApplePassAsync_ReturnsNullForAnUnknownRefOrWrongEmail</seealso>
    /// <seealso>WalletPassServiceTests.BuildApplePassAsync_ThrowsWhenAppleIsNotConfigured</seealso>
    /// <seealso>WalletPassServiceTests.BuildApplePassAsync_RefusesACancelledBooking</seealso>
    /// <seealso>WalletPassServiceTests.BuildApplePassAsync_ProducesASignedPassInTheRestaurantsTimezone</seealso>
    public virtual async Task<byte[]?> BuildApplePassAsync(string bookingRef, string email)
    {
        ApplePassSigner signer = credentials.Apple
            ?? throw new NotFoundException("Apple Wallet passes are not configured on this server.") { Code = ErrorCodes.BookingWalletNotConfigured };

        Booking? booking = await FindOwnedAsync(bookingRef, email);
        if (booking is null)
        {
            return null;
        }

        return ApplePassBuilder.Build(await ContentForAsync(booking), signer);
    }

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>WalletPassServiceTests.BuildGoogleSaveUrlAsync_ReturnsNullForAnUnknownRefOrWrongEmail</seealso>
    /// <seealso>WalletPassServiceTests.BuildGoogleSaveUrlAsync_ThrowsWhenGoogleIsNotConfigured</seealso>
    /// <seealso>WalletPassServiceTests.BuildGoogleSaveUrlAsync_ProducesASaveLinkWithTheBrandLogoWhenPublic</seealso>
    public virtual async Task<string?> BuildGoogleSaveUrlAsync(string bookingRef, string email)
    {
        GoogleWalletIssuer issuer = credentials.Google
            ?? throw new NotFoundException("Google Wallet passes are not configured on this server.") { Code = ErrorCodes.BookingWalletNotConfigured };

        Booking? booking = await FindOwnedAsync(bookingRef, email);
        if (booking is null)
        {
            return null;
        }

        BrandSettings brand = await brandService.GetAsync();
        string websiteUrl = brandService.GetWebsiteUrl(brand);
        bool hasPublicIcon = HasDrawableIcon(brand)
            && Uri.TryCreate(websiteUrl, UriKind.Absolute, out Uri? site)
            && site.Scheme == Uri.UriSchemeHttps;
        string? logoUrl = hasPublicIcon ? $"{websiteUrl.TrimEnd('/')}/api/brand/pwa-icon-192.png" : null;

        return GoogleWalletLinkBuilder.Build(
            await ContentForAsync(booking, brand, websiteUrl),
            issuer,
            websiteUrl.TrimEnd('/'),
            logoUrl,
            new DateTimeOffset(clock.UtcNow, TimeSpan.Zero));
    }

    private async Task<PassContent> ContentForAsync(Booking booking)
    {
        BrandSettings brand = await brandService.GetAsync();
        return await ContentForAsync(booking, brand, brandService.GetWebsiteUrl(brand));
    }

    private Task<PassContent> ContentForAsync(Booking booking, BrandSettings brand, string websiteUrl)
    {
        if (booking.IsCancelled)
        {
            throw new ConflictException("This booking has been cancelled.") { Code = ErrorCodes.BookingWalletCancelled };
        }

        Restaurant restaurant = booking.Restaurant;
        TimeZoneInfo tz = TimeZoneHelper.Resolve(restaurant.Timezone);
        DateTimeOffset starts = ToOffset(booking.Date, tz);
        DateTimeOffset ends = ToOffset(booking.EndTime ?? booking.Date.AddMinutes(restaurant.DefaultBookingDurationMinutes), tz);
        string appName = brand.AppName ?? "Open Resto";

        return Task.FromResult(new PassContent(
            SerialNumber: $"{restaurant.Id}-{booking.BookingRef}",
            OrganizationName: appName,
            Description: $"Reservation at {restaurant.Name}",
            RestaurantName: restaurant.Name,
            RestaurantAddress: restaurant.Address,
            RestaurantPhone: restaurant.PhoneNumber ?? brand.PhoneNumber,
            Starts: starts,
            Ends: ends,
            Seats: booking.Seats,
            BookingRef: booking.BookingRef,
            GuestName: booking.CustomerName,
            SpecialRequests: booking.SpecialRequests,
            ManageUrl: BookingLinks.Confirmation(websiteUrl, booking),
            BackgroundHex: brand.PrimaryColor ?? DefaultPrimaryColor,
            IconSvgPaths: HasDrawableIcon(brand) ? LucideIconPaths.Get(brand.FaviconIcon!) : null));
    }

    private static bool HasDrawableIcon(BrandSettings brand) =>
        !string.IsNullOrEmpty(brand.FaviconIcon) && LucideIconPaths.Get(brand.FaviconIcon) != null;

    private static DateTimeOffset ToOffset(DateTime utc, TimeZoneInfo tz)
    {
        DateTime asUtc = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeFromUtc(asUtc, tz), tz.GetUtcOffset(asUtc));
    }

    private async Task<Booking?> FindOwnedAsync(string bookingRef, string email)
    {
        Booking? booking = await bookingRepository.GetByRefAsync(bookingRef);
        if (booking is null)
        {
            return null;
        }

        return string.Equals(booking.CustomerEmail?.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase)
            ? booking
            : null;
    }
}
