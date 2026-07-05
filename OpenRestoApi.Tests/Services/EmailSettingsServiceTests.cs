using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Email;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class EmailSettingsServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    private static EmailSettingsService CreateService(AppDbContext db, Mock<CredentialProtector>? protectorMock = null, Mock<IEmailService>? emailMock = null)
    {
        protectorMock ??= new Mock<CredentialProtector>(Mock.Of<IDataProtectionProvider>());
        emailMock ??= new Mock<IEmailService>();
        return new EmailSettingsService(
            new EmailSettingsRepository(db),
            new EmailFailureRepository(db),
            protectorMock.Object,
            emailMock.Object);
    }

    [Fact]
    public async Task GetAsync_ReturnsNull_WhenNoSettings()
    {
        using AppDbContext db = CreateDb(nameof(GetAsync_ReturnsNull_WhenNoSettings));
        var svc = CreateService(db);
        Assert.Null(await svc.GetAsync());
    }

    [Fact]
    public async Task GetAsync_ReturnsExistingSettings()
    {
        using AppDbContext db = CreateDb(nameof(GetAsync_ReturnsExistingSettings));
        db.Set<EmailSettings>().Add(new EmailSettings { Host = "smtp.example.com", Port = 587 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        EmailSettings? result = await svc.GetAsync();
        Assert.NotNull(result);
        Assert.Equal("smtp.example.com", result.Host);
    }

    [Fact]
    public async Task SaveAsync_CreatesNewSettings_WhenNoneExist()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_CreatesNewSettings_WhenNoneExist));
        var svc = CreateService(db);
        await svc.SaveAsync("smtp.test.com", 465, "user@test.com", null, true, null, null);

        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.NotNull(result);
        Assert.Equal("smtp.test.com", result.Host);
        Assert.Equal(465, result.Port);
        Assert.Equal("user@test.com", result.Username);
        Assert.True(result.EnableSsl);
    }

    [Fact]
    public async Task SaveAsync_UpdatesExistingSettings()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_UpdatesExistingSettings));
        db.Set<EmailSettings>().Add(new EmailSettings { Host = "old.host", Port = 587 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        await svc.SaveAsync("new.host", 465, "new@user.com", null, false, null, null);

        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.Equal("new.host", result!.Host);
        Assert.Equal(465, result.Port);
        Assert.False(result.EnableSsl);
    }

    [Fact]
    public async Task SaveAsync_EncryptsPassword_WhenProvided()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_EncryptsPassword_WhenProvided));
        var protectorMock = new Mock<CredentialProtector>(Mock.Of<IDataProtectionProvider>());
        protectorMock.Setup(p => p.Encrypt("secret")).Returns("encrypted-secret");

        var svc = CreateService(db, protectorMock);
        await svc.SaveAsync("smtp.test.com", 587, "user", "secret", true, null, null);

        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.Equal("encrypted-secret", result!.EncryptedPassword);
        protectorMock.Verify(p => p.Encrypt("secret"), Times.Once);
    }

    [Fact]
    public async Task SaveAsync_SkipsEncryption_WhenPasswordIsMask()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_SkipsEncryption_WhenPasswordIsMask));
        db.Set<EmailSettings>().Add(new EmailSettings { Host = "smtp", Port = 587, EncryptedPassword = "existing-encrypted" });
        await db.SaveChangesAsync();

        var protectorMock = new Mock<CredentialProtector>(Mock.Of<IDataProtectionProvider>());
        var svc = CreateService(db, protectorMock);
        await svc.SaveAsync("smtp", 587, "user", "••••••••", true, null, null);

        protectorMock.Verify(p => p.Encrypt(It.IsAny<string>()), Times.Never);
        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.Equal("existing-encrypted", result!.EncryptedPassword);
    }

    [Fact]
    public async Task SaveAsync_SkipsEncryption_WhenPasswordIsNull()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_SkipsEncryption_WhenPasswordIsNull));
        var protectorMock = new Mock<CredentialProtector>(Mock.Of<IDataProtectionProvider>());
        var svc = CreateService(db, protectorMock);
        await svc.SaveAsync("smtp.test.com", 587, "user", null, true, null, null);

        protectorMock.Verify(p => p.Encrypt(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SaveAsync_PersistsFromNameAndFromEmail()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_PersistsFromNameAndFromEmail));
        var svc = CreateService(db);
        await svc.SaveAsync("smtp.test.com", 587, "user", null, true, "My Restaurant", "no-reply@myrestaurant.com");

        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.Equal("My Restaurant", result!.FromName);
        Assert.Equal("no-reply@myrestaurant.com", result.FromEmail);
    }

    [Fact]
    public async Task SaveAsync_SetsSendBookingConfirmations()
    {
        using AppDbContext db = CreateDb(nameof(SaveAsync_SetsSendBookingConfirmations));
        var svc = CreateService(db);
        await svc.SaveAsync("smtp.test.com", 587, "user", null, true, null, null, sendBookingConfirmations: true);

        EmailSettings? result = await db.Set<EmailSettings>().FirstOrDefaultAsync();
        Assert.True(result!.SendBookingConfirmations);
    }

    [Fact]
    public async Task TestConnectionAsync_ReturnsTrue_WhenServiceSucceeds()
    {
        using AppDbContext db = CreateDb(nameof(TestConnectionAsync_ReturnsTrue_WhenServiceSucceeds));
        var emailMock = new Mock<IEmailService>();
        emailMock.Setup(e => e.TestConnectionAsync()).ReturnsAsync(true);

        var svc = CreateService(db, emailMock: emailMock);
        Assert.True(await svc.TestConnectionAsync());
    }

    [Fact]
    public async Task TestConnectionAsync_ReturnsFalse_WhenServiceFails()
    {
        using AppDbContext db = CreateDb(nameof(TestConnectionAsync_ReturnsFalse_WhenServiceFails));
        var emailMock = new Mock<IEmailService>();
        emailMock.Setup(e => e.TestConnectionAsync()).ReturnsAsync(false);

        var svc = CreateService(db, emailMock: emailMock);
        Assert.False(await svc.TestConnectionAsync());
    }
}
