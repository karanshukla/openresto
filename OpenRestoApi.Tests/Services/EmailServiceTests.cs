using Microsoft.EntityFrameworkCore;
using Moq;
using MailKit;
using MailKit.Net.Smtp;
using MimeKit;
using OpenRestoApi.Infrastructure.Email;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Core.Domain;
using MailKit.Security;

namespace OpenRestoApi.Tests.Services;

public class EmailServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task TestConnectionAsync_ReturnsFalse_WhenNoSettings()
    {
        using var db = CreateDb(nameof(TestConnectionAsync_ReturnsFalse_WhenNoSettings));
        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        var result = await service.TestConnectionAsync();

        Assert.False(result);
    }

    [Fact]
    public async Task TestConnectionAsync_ConnectsAndAuthenticates_WhenSettingsExist_Port587()
    {
        using var db = CreateDb(nameof(TestConnectionAsync_ConnectsAndAuthenticates_WhenSettingsExist_Port587));
        db.Set<EmailSettings>().Add(new EmailSettings 
        { 
            Host = "smtp.test.com", 
            Port = 587, 
            Username = "user", 
            EncryptedPassword = "encrypted" 
        });
        db.SaveChanges();

        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        protector.Setup(p => p.Decrypt("encrypted")).Returns("decrypted");

        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        var result = await service.TestConnectionAsync();

        Assert.True(result);
        clientMock.Verify(c => c.ConnectAsync("smtp.test.com", 587, SecureSocketOptions.StartTls, default), Times.Once);
        clientMock.Verify(c => c.AuthenticateAsync("user", "decrypted", default), Times.Once);
        clientMock.Verify(c => c.DisconnectAsync(true, default), Times.Once);
    }

    [Fact]
    public async Task TestConnectionAsync_Connects_WhenSettingsExist_Port25_NoSsl()
    {
        using var db = CreateDb(nameof(TestConnectionAsync_Connects_WhenSettingsExist_Port25_NoSsl));
        db.Set<EmailSettings>().Add(new EmailSettings 
        { 
            Host = "smtp.test.com", 
            Port = 25, 
            Username = "user", 
            EncryptedPassword = "encrypted",
            EnableSsl = false
        });
        db.SaveChanges();

        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        protector.Setup(p => p.Decrypt("encrypted")).Returns("decrypted");

        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        var result = await service.TestConnectionAsync();

        Assert.True(result);
        clientMock.Verify(c => c.ConnectAsync("smtp.test.com", 25, SecureSocketOptions.None, default), Times.Once);
    }

    [Fact]
    public async Task SendEmailAsync_Throws_WhenNoSettings()
    {
        using var db = CreateDb(nameof(SendEmailAsync_Throws_WhenNoSettings));
        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => 
            service.SendEmailAsync("to@test.com", "Subject", "Body"));
    }

    [Fact]
    public async Task SendEmailAsync_SendsMessage_WhenSettingsExist()
    {
        using var db = CreateDb(nameof(SendEmailAsync_SendsMessage_WhenSettingsExist));
        db.Set<EmailSettings>().Add(new EmailSettings 
        { 
            Host = "smtp.test.com", 
            Port = 465, 
            Username = "user", 
            EncryptedPassword = "encrypted",
            EnableSsl = true,
            FromName = "Sender",
            FromEmail = "from@test.com"
        });
        db.SaveChanges();

        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        protector.Setup(p => p.Decrypt("encrypted")).Returns("decrypted");

        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        await service.SendEmailAsync("to@test.com", "Subject", "<h1>Body</h1>");

        clientMock.Verify(c => c.ConnectAsync("smtp.test.com", 465, SecureSocketOptions.SslOnConnect, default), Times.Once);
        clientMock.Verify(c => c.AuthenticateAsync("user", "decrypted", default), Times.Once);
        clientMock.Verify(c => c.SendAsync(It.IsAny<MimeMessage>(), default, It.IsAny<ITransferProgress>()), Times.Once);
        clientMock.Verify(c => c.DisconnectAsync(true, default), Times.Once);
    }

    [Fact]
    public async Task SendEmailAsync_UsesUsername_WhenFromEmailMissing()
    {
        using var db = CreateDb(nameof(SendEmailAsync_UsesUsername_WhenFromEmailMissing));
        db.Set<EmailSettings>().Add(new EmailSettings 
        { 
            Host = "smtp.test.com", 
            Port = 587, 
            Username = "user@test.com", 
            EncryptedPassword = "encrypted",
            FromName = null,
            FromEmail = null
        });
        db.SaveChanges();

        var protector = new Mock<CredentialProtector>(new Mock<Microsoft.AspNetCore.DataProtection.IDataProtectionProvider>().Object);
        protector.Setup(p => p.Decrypt("encrypted")).Returns("decrypted");

        var clientMock = new Mock<ISmtpClient>();
        var service = new EmailService(db, protector.Object, () => clientMock.Object);

        await service.SendEmailAsync("to@test.com", "Subject", "Body");

        clientMock.Verify(c => c.SendAsync(It.Is<MimeMessage>(m => 
            m.From.Count == 1 && 
            ((MailboxAddress)m.From[0]).Name == "OpenResto" &&
            ((MailboxAddress)m.From[0]).Address == "user@test.com"), 
            It.IsAny<System.Threading.CancellationToken>(), 
            It.IsAny<ITransferProgress>()), Times.Once);
    }
}
