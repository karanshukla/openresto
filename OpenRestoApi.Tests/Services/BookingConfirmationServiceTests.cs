using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class BookingConfirmationServiceTests
{
    private static BookingConfirmationService CreateService(
        AppDbContext db,
        Mock<IEmailService>? emailServiceMock = null,
        EmailSettingsService? emailSettingsService = null,
        IEmailFailureRepository? emailFailureRepository = null)
    {
        emailServiceMock ??= new Mock<IEmailService>();
        var config = new Mock<IConfiguration>();
        var brand = new BrandService(new BrandSettingsRepository(db), config.Object);
        var template = new EmailTemplateService();
        return new BookingConfirmationService(
            emailSettingsService,
            emailServiceMock.Object,
            emailFailureRepository,
            template,
            brand);
    }

    // Builds a persisted-shape Booking + Restaurant pair without needing the full
    // CreateBookingAsync pipeline (these tests exercise the email layer in isolation).
    private static (Booking booking, Restaurant restaurant) MakeBookingAndRestaurant(
        AppDbContext db,
        string restaurantName = "Test Restaurant",
        string? imageUrl = null,
        string customerEmail = "guest@example.com",
        string? customerName = null)
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Name = restaurantName,
            ImageUrl = imageUrl,
            Timezone = "UTC",
            DefaultBookingDurationMinutes = 120,
        };
        var booking = new Booking
        {
            Id = 1,
            RestaurantId = 1,
            Restaurant = restaurant,
            BookingRef = "ABC123",
            CustomerEmail = customerEmail,
            CustomerName = customerName,
            Seats = 2,
            Date = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc),
            EndTime = new DateTime(2026, 8, 1, 21, 0, 0, DateTimeKind.Utc),
        };
        db.Restaurants.Add(restaurant);
        db.Bookings.Add(booking);
        db.SaveChanges();
        return (booking, restaurant);
    }

    private static EmailSettingsService MockSettingsService(EmailSettings settings)
    {
        // EmailSettingsService is concrete-injected; the cheapest stub for these tests is a
        // Moq'd instance whose GetAsync() returns the seeded settings. 4 null! ctor args.
        var mock = new Mock<EmailSettingsService>(null!, null!, null!, null!);
        mock.Setup(s => s.GetAsync()).ReturnsAsync(settings);
        return mock.Object;
    }

    // ── Send path ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendConfirmationAsync_SendsEmail_WhenEnabled()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_SendsEmail_WhenEnabled));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        var settings = new EmailSettings { SendBookingConfirmations = true };
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(settings));

        await svc.SendConfirmationAsync(booking, restaurant);

        emailServiceMock.Verify(
            e => e.SendEmailAsync("guest@example.com", It.IsAny<string>(), It.IsAny<string>()),
            Times.Once);
    }

    [Fact]
    public async Task SendConfirmationAsync_EmailHtml_ContainsRestaurantImage_WhenImageUrlSet()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_EmailHtml_ContainsRestaurantImage_WhenImageUrlSet));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db, imageUrl: "https://cdn.example.com/photo.jpg", restaurantName: "Pic Restaurant");
        string? capturedBody = null;
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Callback<string, string, string>((_, _, body) => capturedBody = body)
            .Returns(Task.CompletedTask);
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }));

        await svc.SendConfirmationAsync(booking, restaurant);

        Assert.NotNull(capturedBody);
        Assert.Contains("https://cdn.example.com/photo.jpg", capturedBody);
    }

    [Fact]
    public async Task SendConfirmationAsync_EmailHtml_ContainsFaviconSvg_WhenNoRestaurantImageButFaviconSet()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_EmailHtml_ContainsFaviconSvg_WhenNoRestaurantImageButFaviconSet));
        db.Set<BrandSettings>().Add(new BrandSettings { FaviconIcon = "utensils" });
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db, restaurantName: "Icon Restaurant");
        string? capturedBody = null;
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Callback<string, string, string>((_, _, body) => capturedBody = body)
            .Returns(Task.CompletedTask);
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }));

        await svc.SendConfirmationAsync(booking, restaurant);

        Assert.NotNull(capturedBody);
        Assert.Contains("/api/brand/pwa-icon.svg", capturedBody);
        Assert.DoesNotContain("cdn.example.com", capturedBody);
    }

    [Fact]
    public async Task SendConfirmationAsync_EmailHtml_HasNoImage_WhenNeitherRestaurantImageNorFaviconSet()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_EmailHtml_HasNoImage_WhenNeitherRestaurantImageNorFaviconSet));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db, restaurantName: "Plain Restaurant");
        string? capturedBody = null;
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Callback<string, string, string>((_, _, body) => capturedBody = body)
            .Returns(Task.CompletedTask);
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }));

        await svc.SendConfirmationAsync(booking, restaurant);

        Assert.NotNull(capturedBody);
        Assert.DoesNotContain("<img", capturedBody);
    }

    // ── Skip path ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendConfirmationAsync_DoesNotSendEmail_WhenConfirmationsDisabled()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_DoesNotSendEmail_WhenConfirmationsDisabled));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = false }));

        await svc.SendConfirmationAsync(booking, restaurant);

        emailServiceMock.Verify(
            e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task SendConfirmationAsync_DoesNotSendEmail_WhenCustomerEmailMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_DoesNotSendEmail_WhenCustomerEmailMissing));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db, customerEmail: null!);
        var emailServiceMock = new Mock<IEmailService>();
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }));

        await svc.SendConfirmationAsync(booking, restaurant);

        emailServiceMock.Verify(
            e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task SendConfirmationAsync_DoesNotSendEmail_WhenSettingsServiceNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_DoesNotSendEmail_WhenSettingsServiceNull));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        // No emailSettingsService passed — null short-circuit must skip the send entirely.
        BookingConfirmationService svc = CreateService(db, emailServiceMock, emailSettingsService: null);

        await svc.SendConfirmationAsync(booking, restaurant);

        emailServiceMock.Verify(
            e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task SendConfirmationAsync_DoesNotSendEmail_WhenEmailServiceNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_DoesNotSendEmail_WhenEmailServiceNull));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        // Pass a null IEmailService directly (Mock.Object is non-null, so use the ctor).
        var config = new Mock<IConfiguration>();
        var svc = new BookingConfirmationService(
            MockSettingsService(new EmailSettings { SendBookingConfirmations = true }),
            emailService: null,
            emailFailureRepository: null,
            new EmailTemplateService(),
            new BrandService(new BrandSettingsRepository(db), config.Object));

        // Must not throw despite null emailService.
        await svc.SendConfirmationAsync(booking, restaurant);
    }

    // ── Failure path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendConfirmationAsync_NeverThrows_WhenEmailSendFails()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_NeverThrows_WhenEmailSendFails));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("SMTP failure"));
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }));

        // Best-effort contract: must not propagate the SMTP exception.
        await svc.SendConfirmationAsync(booking, restaurant);
    }

    [Fact]
    public async Task SendConfirmationAsync_PersistsEmailFailure_WhenSendThrowsAndRepositoryConfigured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_PersistsEmailFailure_WhenSendThrowsAndRepositoryConfigured));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("SMTP failure"));
        var failureRepo = new EmailFailureRepository(db);
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }), failureRepo);

        await svc.SendConfirmationAsync(booking, restaurant);

        List<EmailFailure> failures = await db.Set<EmailFailure>().ToListAsync();
        var failure = Assert.Single(failures);
        Assert.Equal("ABC123", failure.BookingRef);
        Assert.Equal("guest@example.com", failure.RecipientEmail);
        Assert.Contains("SMTP failure", failure.ErrorMessage);
    }

    [Fact]
    public async Task SendConfirmationAsync_DoesNotPersistFailure_WhenRepositoryNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendConfirmationAsync_DoesNotPersistFailure_WhenRepositoryNull));
        (Booking booking, Restaurant restaurant) = MakeBookingAndRestaurant(db);
        var emailServiceMock = new Mock<IEmailService>();
        emailServiceMock
            .Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("SMTP failure"));
        // No IEmailFailureRepository passed — the catch must still not throw, and must not persist.
        BookingConfirmationService svc = CreateService(db, emailServiceMock, MockSettingsService(new EmailSettings { SendBookingConfirmations = true }), emailFailureRepository: null);

        await svc.SendConfirmationAsync(booking, restaurant);

        Assert.Empty(await db.Set<EmailFailure>().ToListAsync());
    }
}
