using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class RestaurantBookingAlertServiceTests
{
    private static RestaurantBookingAlertService CreateService(
        AppDbContext db,
        Mock<IEmailService> emailService,
        EmailSettings? settings)
    {
        var settingsMock = new Mock<EmailSettingsService>(null!, null!, null!, null!);
        settingsMock.Setup(s => s.GetAsync()).ReturnsAsync(settings);
        var brand = new BrandService(new BrandSettingsRepository(db), new Mock<IConfiguration>().Object);
        return new RestaurantBookingAlertService(
            settingsMock.Object,
            emailService.Object,
            new EmailFailureRepository(db),
            new EmailTemplateService(),
            brand,
            new RestaurantRepository(db),
            new BookingRepository(db),
            NullLogger<RestaurantBookingAlertService>.Instance);
    }

    private static EmailSettings AlertsOn() => new() { Host = "smtp.test", SendRestaurantBookingAlerts = true };

    private static Booking Seed(AppDbContext db, string? restaurantEmail = "front@bistro.test", string? brandEmail = null)
    {
        var restaurant = new Restaurant { Id = 1, Name = "Bistro", Timezone = "UTC", EmailAddress = restaurantEmail };
        var section = new Section { Id = 1, Name = "Terrace", RestaurantId = 1 };
        var table = new Table { Id = 1, Name = "T4", Seats = 4, SectionId = 1 };
        var booking = new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            BookingRef = "ABC123",
            CustomerName = "Alice",
            CustomerEmail = "alice@example.com",
            Seats = 2,
            Date = new DateTime(2026, 8, 1, 19, 0, 0, DateTimeKind.Utc),
            EndTime = new DateTime(2026, 8, 1, 21, 0, 0, DateTimeKind.Utc),
        };
        db.Restaurants.Add(restaurant);
        db.Sections.Add(section);
        db.Tables.Add(table);
        db.Bookings.Add(booking);
        if (brandEmail != null)
        {
            db.Set<BrandSettings>().Add(new BrandSettings { EmailAddress = brandEmail });
        }
        db.SaveChanges();
        // The worker is handed a detached entity with nothing loaded on it.
        return new Booking { Id = 1, RestaurantId = 1, BookingRef = "ABC123", Seats = 2, Date = booking.Date };
    }

    private static Mock<IEmailService> CapturingEmail(Action<string, string, string> capture)
    {
        var mock = new Mock<IEmailService>();
        mock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Callback(capture)
            .Returns(Task.CompletedTask);
        return mock;
    }

    [Fact]
    public async Task SendBookingCreatedAsync_EmailsTheLocationsOwnAddress()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_EmailsTheLocationsOwnAddress));
        Booking booking = Seed(db, restaurantEmail: "front@bistro.test", brandEmail: "hello@brand.test");
        (string to, string subject, string body) = ("", "", "");
        Mock<IEmailService> email = CapturingEmail((t, s, b) => (to, subject, body) = (t, s, b));

        await CreateService(db, email, AlertsOn()).SendBookingCreatedAsync(booking);

        Assert.Equal("front@bistro.test", to);
        Assert.StartsWith("New booking", subject);
        Assert.Contains("Bistro", subject);
        // Reloaded from the row, so the seating the detached entity never carried is in the body.
        Assert.Contains("Terrace", body);
        Assert.Contains("T4", body);
        Assert.Contains("ABC123", body);
        Assert.Contains("/admin/bookings?query=ABC123", body);
    }

    [Fact]
    public async Task SendBookingCreatedAsync_FallsBackToTheBrandAddress()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_FallsBackToTheBrandAddress));
        Booking booking = Seed(db, restaurantEmail: null, brandEmail: "hello@brand.test");
        var email = new Mock<IEmailService>();

        await CreateService(db, email, AlertsOn()).SendBookingCreatedAsync(booking);

        email.Verify(e => e.SendEmailAsync("hello@brand.test", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task SendBookingCancelledAsync_SaysCancelled()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCancelledAsync_SaysCancelled));
        Booking booking = Seed(db);
        string subject = "";
        Mock<IEmailService> email = CapturingEmail((_, s, _) => subject = s);

        await CreateService(db, email, AlertsOn()).SendBookingCancelledAsync(booking);

        Assert.StartsWith("Booking cancelled", subject);
    }

    [Fact]
    public async Task SendBookingCreatedAsync_SendsNothing_WhenAlertsAreOff()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_SendsNothing_WhenAlertsAreOff));
        Booking booking = Seed(db);
        var email = new Mock<IEmailService>();

        await CreateService(db, email, new EmailSettings { Host = "smtp.test", SendBookingConfirmations = true })
            .SendBookingCreatedAsync(booking);

        email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SendBookingCreatedAsync_SendsNothing_WhenMailIsNotConfigured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_SendsNothing_WhenMailIsNotConfigured));
        Booking booking = Seed(db);
        var email = new Mock<IEmailService>();

        await CreateService(db, email, settings: null).SendBookingCreatedAsync(booking);

        email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        Assert.Empty(await db.EmailFailures.ToListAsync());
    }

    [Fact]
    public async Task SendBookingCreatedAsync_SendsNothing_WhenNoAddressResolves()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_SendsNothing_WhenNoAddressResolves));
        Booking booking = Seed(db, restaurantEmail: "  ", brandEmail: null);
        var email = new Mock<IEmailService>();

        await CreateService(db, email, AlertsOn()).SendBookingCreatedAsync(booking);

        email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        Assert.Empty(await db.EmailFailures.ToListAsync());
    }

    [Fact]
    public async Task SendBookingCreatedAsync_SendsNothing_WhenTheRestaurantIsGone()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_SendsNothing_WhenTheRestaurantIsGone));
        var email = new Mock<IEmailService>();

        await CreateService(db, email, AlertsOn()).SendBookingCreatedAsync(new Booking { Id = 99, RestaurantId = 99, BookingRef = "GONE" });

        email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SendBookingCreatedAsync_RecordsAFailure_WhenTheSendThrows()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SendBookingCreatedAsync_RecordsAFailure_WhenTheSendThrows));
        Booking booking = Seed(db);
        var email = new Mock<IEmailService>();
        email.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("SMTP refused"));

        await CreateService(db, email, AlertsOn()).SendBookingCreatedAsync(booking);

        EmailFailure failure = Assert.Single(await db.EmailFailures.ToListAsync());
        Assert.Equal("ABC123", failure.BookingRef);
        Assert.Equal("front@bistro.test", failure.RecipientEmail);
        Assert.Equal("SMTP refused", failure.ErrorMessage);
    }
}
