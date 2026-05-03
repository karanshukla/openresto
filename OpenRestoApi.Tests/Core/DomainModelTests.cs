using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using Xunit;

namespace OpenRestoApi.Tests.Core;

public class DomainModelTests
{
    [Fact]
    public void AdminCredential_PropertyAccess()
    {
        var cred = new AdminCredential
        {
            Id = 1,
            Email = "t@t.com",
            PasswordHash = "H",
            PasswordSalt = "S",
            PvqQuestion = "Q",
            PvqAnswerHash = "AH",
            PvqAnswerSalt = "AS",
            ResetToken = "T",
            ResetTokenExpiry = DateTime.UtcNow
        };

        Assert.Equal(1, cred.Id);
        Assert.Equal("t@t.com", cred.Email);
        Assert.Equal("H", cred.PasswordHash);
        Assert.Equal("S", cred.PasswordSalt);
        Assert.Equal("Q", cred.PvqQuestion);
        Assert.Equal("AH", cred.PvqAnswerHash);
        Assert.Equal("AS", cred.PvqAnswerSalt);
        Assert.Equal("T", cred.ResetToken);
        Assert.NotNull(cred.ResetTokenExpiry);
    }

    [Fact]
    public void HoldEntry_PropertyAccess()
    {
        var entry = new HoldEntry("ID", 1, 2, 3, DateTime.Now, DateTime.Now.AddMinutes(1));
        Assert.Equal("ID", entry.HoldId);
        Assert.Equal(1, entry.TableId);
        Assert.Equal(2, entry.SectionId);
        Assert.Equal(3, entry.RestaurantId);
    }

    [Fact]
    public void Section_PropertyAccess()
    {
        var section = new Section { Id = 1, Name = "S", RestaurantId = 2, Tables = [] };
        Assert.Equal(1, section.Id);
        Assert.Equal("S", section.Name);
        Assert.Equal(2, section.RestaurantId);
        Assert.Empty(section.Tables);
    }

    [Fact]
    public void BrandSettings_PropertyAccess()
    {
        var settings = new BrandSettings { Id = 1, AppName = "A", PrimaryColor = "P", AccentColor = "C", LogoBase64 = "L" };
        Assert.Equal(1, settings.Id);
        Assert.Equal("A", settings.AppName);
        Assert.Equal("P", settings.PrimaryColor);
        Assert.Equal("C", settings.AccentColor);
        Assert.Equal("L", settings.LogoBase64);
    }

    [Fact]
    public void EmailSettings_PropertyAccess()
    {
        var settings = new EmailSettings 
        { 
            Id = 1, Host = "H", Port = 587, Username = "U", 
            EncryptedPassword = "P", EnableSsl = true, 
            FromName = "FN", FromEmail = "FE" 
        };
        Assert.Equal(1, settings.Id);
        Assert.Equal("H", settings.Host);
        Assert.Equal(587, settings.Port);
        Assert.Equal("U", settings.Username);
        Assert.Equal("P", settings.EncryptedPassword);
        Assert.True(settings.EnableSsl);
        Assert.Equal("FN", settings.FromName);
        Assert.Equal("FE", settings.FromEmail);
    }
}
