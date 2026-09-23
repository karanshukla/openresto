using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Services;

public class WaitlistReadyNotifierTests
{
    private readonly Mock<IEmailService> _email = new();
    private readonly Restaurant _restaurant = new() { Id = 1, Name = "Door" };

    private WaitlistReadyNotifier CreateNotifier(AppDbContext db, EmailSettings? settings)
    {
        var settingsService = new Mock<EmailSettingsService>(null!, null!, null!, null!);
        settingsService.Setup(s => s.GetAsync()).ReturnsAsync(settings);
        var brand = new BrandService(new BrandSettingsRepository(db), new Mock<IConfiguration>().Object);
        return new WaitlistReadyNotifier(settingsService.Object, _email.Object, brand, NullLogger<WaitlistReadyNotifier>.Instance);
    }

    private static WaitlistEntry Entry(string? email) => new() { Id = 3, Ref = "abc", Number = 4, Name = "Ada", Email = email, Locale = "de" };

    [Fact]
    public async Task NotifyAsync_EmailsTheGuest_InTheirLanguage()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(NotifyAsync_EmailsTheGuest_InTheirLanguage));

        await CreateNotifier(db, new EmailSettings()).NotifyAsync(Entry("ada@example.com"), _restaurant);

        _email.Verify(e => e.SendEmailAsync("ada@example.com", "Ihr Tisch im Door ist bereit", It.Is<string>(b => b.Contains("/waitlist/abc"))), Times.Once);
    }

    [Fact]
    public async Task NotifyAsync_SendsNothing_WithoutAnAddress()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(NotifyAsync_SendsNothing_WithoutAnAddress));

        await CreateNotifier(db, new EmailSettings()).NotifyAsync(Entry(null), _restaurant);

        _email.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NotifyAsync_SendsNothing_WhenMailIsNotConfigured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(NotifyAsync_SendsNothing_WhenMailIsNotConfigured));

        await CreateNotifier(db, null).NotifyAsync(Entry("ada@example.com"), _restaurant);

        _email.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NotifyAsync_SwallowsASendFailure()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(NotifyAsync_SwallowsASendFailure));
        _email.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("smtp down"));

        Exception? thrown = await Record.ExceptionAsync(
            () => CreateNotifier(db, new EmailSettings()).NotifyAsync(Entry("ada@example.com"), _restaurant));

        Assert.Null(thrown);
    }
}
