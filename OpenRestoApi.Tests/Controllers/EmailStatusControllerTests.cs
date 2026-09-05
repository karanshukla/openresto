using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Controllers;

/// <summary>
/// The read-only email surface an API key may reach (issue #407): enough to tell whether guests
/// are receiving anything, and nothing about how mail is configured.
/// </summary>
public class EmailStatusControllerTests
{
    private readonly Mock<EmailSettingsService> _service = new(null!, null!, null!, null!);
    private readonly Mock<IRestaurantRepository> _restaurants = new();
    private readonly Mock<IBrandSettingsRepository> _brand = new();

    private EmailStatusController ControllerFor(ICurrentUserService currentUser)
        => new(_service.Object, currentUser, PreviewService());

    public EmailStatusControllerTests()
    {
        // Defaults, so a test that is not about the preview needs no arrangement for it. A test
        // that is re-stubs the location list; setting these up per-controller would overwrite it.
        _restaurants.Setup(r => r.GetAllActiveWithSectionsAsync()).ReturnsAsync([]);
        _brand.Setup(b => b.GetAsync()).ReturnsAsync(new BrandSettings());
    }

    private EmailPreviewService PreviewService()
    {
        return new EmailPreviewService(
            _restaurants.Object,
            new BrandService(_brand.Object, new ConfigurationBuilder().Build()),
            new EmailTemplateService(),
            new SystemClock());
    }

    private static EmailSettings Configured(bool sendBookingConfirmations) => new()
    {
        Host = "smtp.test.com",
        Port = 587,
        Username = "user@test.com",
        EncryptedPassword = "enc",
        FromEmail = "hello@test.com",
        SendBookingConfirmations = sendBookingConfirmations,
    };

    private static EmailStatusResponse StatusOf(IActionResult result)
        => Assert.IsType<EmailStatusResponse>(Assert.IsType<OkObjectResult>(result).Value);

    private static List<EmailFailureResponse> FailuresOf(IActionResult result)
        => [.. Assert.IsAssignableFrom<IEnumerable<EmailFailureResponse>>(
            Assert.IsType<OkObjectResult>(result).Value)];

    [Fact]
    public async Task Status_WhenUnconfigured_ReportsNotConfigured()
    {
        _service.Setup(s => s.GetAsync()).ReturnsAsync((EmailSettings?)null);

        EmailStatusResponse status = StatusOf(await ControllerFor(FakeCurrentUser.Anonymous()).Status());

        Assert.False(status.IsConfigured);
        Assert.False(status.SendBookingConfirmations);
        Assert.Null(status.FromEmail);
    }

    /// <summary>
    /// SMTP missing and confirmations switched off have the same visible effect — the guest
    /// receives nothing — and a script has to be able to act on the difference.
    /// </summary>
    [Fact]
    public async Task Status_WhenConfiguredWithConfirmationsOff_SeparatesTheTwoCauses()
    {
        _service.Setup(s => s.GetAsync()).ReturnsAsync(Configured(sendBookingConfirmations: false));

        EmailStatusResponse status = StatusOf(await ControllerFor(FakeCurrentUser.Anonymous()).Status());

        Assert.True(status.IsConfigured);
        Assert.False(status.SendBookingConfirmations);
        Assert.Equal("hello@test.com", status.FromEmail);
    }

    [Fact]
    public async Task Status_WhenFullyConfigured_ReportsBothOn()
    {
        _service.Setup(s => s.GetAsync()).ReturnsAsync(Configured(sendBookingConfirmations: true));

        EmailStatusResponse status = StatusOf(await ControllerFor(FakeCurrentUser.Anonymous()).Status());

        Assert.True(status.IsConfigured);
        Assert.True(status.SendBookingConfirmations);
    }

    private void SetupOneFailure()
    {
        _service.Setup(s => s.GetFailuresAsync()).ReturnsAsync(new List<EmailFailure>
        {
            new()
            {
                Id = 1,
                BookingRef = "ABC",
                RecipientEmail = "guest@test.com",
                ErrorMessage = "err",
                AttemptedAt = DateTime.UtcNow,
            },
        });
    }

    [Fact]
    public async Task Failures_ReturnsTheMappedList()
    {
        SetupOneFailure();

        List<EmailFailureResponse> failures =
            FailuresOf(await ControllerFor(FakeCurrentUser.Anonymous()).GetFailures());

        EmailFailureResponse only = Assert.Single(failures);
        Assert.Equal(1, only.Id);
        Assert.Equal("ABC", only.BookingRef);
        Assert.Equal("err", only.ErrorMessage);
    }

    /// <summary>
    /// The pair that keeps the failure list from becoming a way around the guests redaction: the
    /// recipient of a failed booking confirmation is a customer's email address.
    /// </summary>
    [Fact]
    public async Task Failures_WithoutGuestScope_RedactsTheRecipient()
    {
        SetupOneFailure();
        ICurrentUserService key = FakeCurrentUser.ApiKey((ApiKeyScopes.Email, ApiKeyScopes.Read));

        List<EmailFailureResponse> failures = FailuresOf(await ControllerFor(key).GetFailures());

        Assert.Null(Assert.Single(failures).RecipientEmail);
    }

    [Fact]
    public async Task Failures_WithGuestScope_KeepsTheRecipient()
    {
        SetupOneFailure();
        ICurrentUserService key = FakeCurrentUser.ApiKey(
            (ApiKeyScopes.Email, ApiKeyScopes.Read),
            (ApiKeyScopes.Guests, ApiKeyScopes.Read));

        List<EmailFailureResponse> failures = FailuresOf(await ControllerFor(key).GetFailures());

        Assert.Equal("guest@test.com", Assert.Single(failures).RecipientEmail);
    }

    /// <summary>
    /// Rendering the confirmation for a location the admin picked is the whole of the preview:
    /// the same template the send path uses, against that location's own name and branding.
    /// </summary>
    [Fact]
    public async Task Preview_RendersTheRequestedLocation()
    {
        _restaurants.Setup(r => r.GetAllActiveWithSectionsAsync()).ReturnsAsync(
        [
            new Restaurant { Id = 1, Name = "Riverside", Timezone = "UTC" },
            new Restaurant { Id = 2, Name = "Old Town", Timezone = "UTC" },
        ]);

        var result = Assert.IsType<EmailPreviewResult>(
            Assert.IsType<OkObjectResult>(
                await ControllerFor(FakeCurrentUser.Anonymous()).Preview(restaurantId: 2)).Value);

        Assert.Equal("Old Town", result.RestaurantName);
        Assert.Contains("Old Town", result.Html, StringComparison.Ordinal);
        Assert.Contains("Old Town", result.Subject, StringComparison.Ordinal);
    }
}
