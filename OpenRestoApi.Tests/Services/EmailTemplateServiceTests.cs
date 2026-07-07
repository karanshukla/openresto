using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class EmailTemplateServiceTests
{
    private readonly EmailTemplateService _svc = new();

    private static readonly BrandSettings _defaultBrand = new()
    {
        AppName = "Open Resto",
        PrimaryColor = "#0a7ea4",
    };

    private const string DefaultWebsiteUrl = "https://openres.to";

    private static Restaurant MakeRestaurant(string? imageUrl = null, string? address = null) => new()
    {
        Id = 1,
        Name = "Testaurant",
        ImageUrl = imageUrl,
        Address = address,
        Timezone = "UTC",
        DefaultBookingDurationMinutes = 120,
    };

    private static Booking MakeBooking(
        string bookingRef = "REF-XYZ",
        string customerEmail = "guest@example.com",
        string? customerName = null,
        string? specialRequests = null,
        string? sectionName = null,
        string? tableName = null,
        int? tableId = 1) => new()
    {
        BookingRef = bookingRef,
        CustomerEmail = customerEmail,
        CustomerName = customerName,
        SpecialRequests = specialRequests,
        Seats = 2,
        Date = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc),
        EndTime = new DateTime(2026, 8, 1, 21, 0, 0, DateTimeKind.Utc),
        Section = sectionName == null ? null : new Section { Name = sectionName },
        Table = tableName == null ? null : new Table { Name = tableName },
        TableId = tableId,
    };

    // ── Header variants ─────────────────────────────────────────────────────────

    [Fact]
    public void BuildConfirmationEmail_RendersBannerHeader_WhenRestaurantHasImageUrl()
    {
        var restaurant = MakeRestaurant(imageUrl: "https://cdn.example.com/photo.jpg");

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("https://cdn.example.com/photo.jpg", html);
    }

    [Fact]
    public void BuildConfirmationEmail_PrefixesRelativeImageUrl_WithWebsiteUrl()
    {
        var restaurant = MakeRestaurant(imageUrl: "media/restaurant.jpg");

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("https://openres.to/media/restaurant.jpg", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersIconHeader_WhenNoRestaurantImage_ButFaviconSet()
    {
        var restaurant = MakeRestaurant(imageUrl: null);
        var brand = new BrandSettings { AppName = "Branded", PrimaryColor = "#ff0000", FaviconIcon = "utensils" };

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, brand, DefaultWebsiteUrl);

        Assert.Contains("/api/brand/pwa-icon.svg", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersPlainTextHeader_WhenNeitherImageNorFavicon()
    {
        var restaurant = MakeRestaurant(imageUrl: null);

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.DoesNotContain("<img", html);
        Assert.Contains(restaurant.Name, html);
    }

    // ── Lookup URL ──────────────────────────────────────────────────────────────

    [Fact]
    public void BuildConfirmationEmail_EncodesLookupUrl_WithBookingRefAndEmail()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        // The lookup URL is /booking-confirmation/{ref}?email={email}; both segments are
        // Uri.EscapeDataString-escaped. Hyphens survive (unreserved); '@' becomes %40.
        Assert.Contains("https://openres.to/booking-confirmation/REF-XYZ?email=guest%40example.com", html);
    }

    [Fact]
    public void BuildConfirmationEmail_TrimsTrailingSlash_FromWebsiteUrl()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, "https://openres.to/");

        Assert.Contains("https://openres.to/booking-confirmation/", html);
        Assert.DoesNotContain("openres.to//booking", html);
    }

    // ── Optional blocks ─────────────────────────────────────────────────────────

    [Fact]
    public void BuildConfirmationEmail_RendersSectionRow_WhenSectionPresent()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(sectionName: "Patio"), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("Section", html);
        Assert.Contains("Patio", html);
    }

    [Fact]
    public void BuildConfirmationEmail_OmitsSectionRow_WhenSectionAbsent()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(sectionName: null), restaurant, _defaultBrand, DefaultWebsiteUrl);

        // No section label rendered when the booking has no section attached.
        Assert.DoesNotContain(">Section<", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersTableRow_WhenTableNameSet()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(tableName: "Patio-3"), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains(">Table<", html);
        Assert.Contains("Patio-3", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersTableIdFallbackLabel_WhenTableNavMissing_ButIdPresent()
    {
        var restaurant = MakeRestaurant();
        // No Table nav object, but a TableId is present — fallback label is "Table #{id}".
        var booking = MakeBooking(tableName: null, tableId: 7);

        string html = _svc.BuildConfirmationEmail(booking, restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("Table #7", html);
    }

    [Fact]
    public void BuildConfirmationEmail_OmitsTableRow_WhenNeitherTableNameNorId()
    {
        var restaurant = MakeRestaurant();
        var booking = MakeBooking(tableName: null, tableId: null);

        string html = _svc.BuildConfirmationEmail(booking, restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.DoesNotContain(">Table<", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersSpecialRequests_WhenPresent()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(specialRequests: "Window seat please"), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("Special requests", html);
        Assert.Contains("Window seat please", html);
    }

    [Fact]
    public void BuildConfirmationHtml_EncodesSpecialRequests_ToPreventHtmlInjection()
    {
        var restaurant = MakeRestaurant();
        // A raw <script> in special requests must be HTML-escaped, not rendered as a tag.
        var booking = MakeBooking(specialRequests: "<script>alert(1)</script>");

        string html = _svc.BuildConfirmationEmail(booking, restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.DoesNotContain("<script>alert(1)</script>", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public void BuildConfirmationEmail_OmitsSpecialRequests_WhenAbsent()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(specialRequests: null), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.DoesNotContain("Special requests", html);
    }

    [Fact]
    public void BuildConfirmationEmail_RendersDirections_WhenAddressSet()
    {
        var restaurant = MakeRestaurant(address: "123 Main St");

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("123 Main St", html);
        Assert.Contains("maps/search", html);
    }

    [Fact]
    public void BuildConfirmationEmail_OmitsDirections_WhenAddressAbsent()
    {
        var restaurant = MakeRestaurant(address: null);

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.DoesNotContain("maps/search", html);
        Assert.DoesNotContain("Get directions", html);
    }

    // ── Greeting ────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildConfirmationEmail_UsesPersonalisedGreeting_WhenCustomerNameSet()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(customerName: "Alice"), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("You're all set, Alice!", html);
    }

    [Fact]
    public void BuildConfirmationEmail_UsesGenericGreeting_WhenCustomerNameAbsent()
    {
        var restaurant = MakeRestaurant();

        string html = _svc.BuildConfirmationEmail(MakeBooking(customerName: null), restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains("You're all set!", html);
    }

    // ── Guest pluralisation ─────────────────────────────────────────────────────

    [Theory]
    [InlineData(1, "guest")]
    [InlineData(2, "guests")]
    [InlineData(5, "guests")]
    public void BuildConfirmationEmail_PluralisesGuestLabel_Correctly(int seats, string expectedWord)
    {
        var restaurant = MakeRestaurant();
        var booking = MakeBooking();
        booking.Seats = seats;

        string html = _svc.BuildConfirmationEmail(booking, restaurant, _defaultBrand, DefaultWebsiteUrl);

        Assert.Contains($"{seats} {expectedWord}", html);
    }

    // ── Brand fallbacks ─────────────────────────────────────────────────────────

    [Fact]
    public void BuildConfirmationEmail_FallsBackToDefaultColor_WhenBrandColorNull()
    {
        var restaurant = MakeRestaurant();
        var brand = new BrandSettings { AppName = "X", PrimaryColor = null! };

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, brand, DefaultWebsiteUrl);

        Assert.Contains("#0a7ea4", html);
    }

    [Fact]
    public void BuildConfirmationEmail_FallsBackToDefaultAppName_WhenBrandAppNameNull()
    {
        var restaurant = MakeRestaurant();
        var brand = new BrandSettings { AppName = null!, PrimaryColor = "#000000" };

        string html = _svc.BuildConfirmationEmail(MakeBooking(), restaurant, brand, DefaultWebsiteUrl);

        Assert.Contains("Open Resto", html);
    }
}
