using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace OpenRestoApi.Tests.Integration;

public class EmailSettingsControllerTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    public EmailSettingsControllerTests(TestWebAppFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Get_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/admin/email-settings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_WhenNoSettingsExist_ReturnsEmptyResponse()
    {
        // Ensure no email settings exist (other tests may have inserted them)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<OpenRestoApi.Infrastructure.Persistence.AppDbContext>();
            var existing = await db.Set<OpenRestoApi.Core.Domain.EmailSettings>().ToListAsync();
            db.Set<OpenRestoApi.Core.Domain.EmailSettings>().RemoveRange(existing);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/admin/email-settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(string.Empty, body.GetProperty("host").GetString());
        Assert.Equal(587, body.GetProperty("port").GetInt32());
        Assert.False(body.GetProperty("isConfigured").GetBoolean());
    }

    [Fact]
    public async Task Save_ThenGet_ReturnsSavedSettingsWithMaskedPassword()
    {
        var client = _factory.CreateAuthenticatedClient();

        var saveResponse = await client.PostAsJsonAsync("/api/admin/email-settings", new
        {
            host = "smtp.example.com",
            port = 465,
            username = "user@example.com",
            password = "supersecret",
            enableSsl = true,
            fromName = "Test Sender",
            fromEmail = "noreply@example.com"
        });

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);

        var getResponse = await client.GetAsync("/api/admin/email-settings");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("smtp.example.com", body.GetProperty("host").GetString());
        Assert.Equal(465, body.GetProperty("port").GetInt32());
        Assert.Equal("user@example.com", body.GetProperty("username").GetString());
        Assert.Equal("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", body.GetProperty("password").GetString());
        Assert.True(body.GetProperty("enableSsl").GetBoolean());
        Assert.Equal("Test Sender", body.GetProperty("fromName").GetString());
        Assert.Equal("noreply@example.com", body.GetProperty("fromEmail").GetString());
        Assert.True(body.GetProperty("isConfigured").GetBoolean());
    }

    [Fact]
    public async Task Save_WithMaskedPassword_PreservesOriginalEncryptedPassword()
    {
        var client = _factory.CreateAuthenticatedClient();

        // First save with a real password
        await client.PostAsJsonAsync("/api/admin/email-settings", new
        {
            host = "smtp.preserve.com",
            port = 587,
            username = "preserve@example.com",
            password = "original-secret",
            enableSsl = true,
            fromName = "Preserve Test",
            fromEmail = "preserve@example.com"
        });

        // Read back the encrypted password from the database for comparison
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<OpenRestoApi.Infrastructure.Persistence.AppDbContext>();
        var settingsBefore = await db.Set<OpenRestoApi.Core.Domain.EmailSettings>()
            .FirstAsync();
        var encryptedBefore = settingsBefore.EncryptedPassword;

        // Now save again with the masked password (simulating the UI sending back "••••••••")
        await client.PostAsJsonAsync("/api/admin/email-settings", new
        {
            host = "smtp.updated.com",
            port = 587,
            username = "preserve@example.com",
            password = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            enableSsl = true,
            fromName = "Preserve Test",
            fromEmail = "preserve@example.com"
        });

        // The encrypted password should be unchanged
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<OpenRestoApi.Infrastructure.Persistence.AppDbContext>();
        var settingsAfter = await db2.Set<OpenRestoApi.Core.Domain.EmailSettings>()
            .FirstAsync();

        Assert.Equal(encryptedBefore, settingsAfter.EncryptedPassword);
        // But the host should have been updated
        Assert.Equal("smtp.updated.com", settingsAfter.Host);
    }

    [Fact]
    public async Task Test_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/admin/email-settings/test", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
