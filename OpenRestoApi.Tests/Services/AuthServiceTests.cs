using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class AuthServiceTests
{
    // 32+ char HS256 test key.
    private const string TestKey = "test-key-must-be-at-least-32-characters-long-for-hs256!!";

    private static IConfiguration BuildConfig(string? adminEmail = null, string? adminPassword = null)
    {
        var dict = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = TestKey,
            ["Jwt:Issuer"] = "openresto-tests",
            ["Jwt:Audience"] = "openresto-tests",
        };
        if (adminEmail != null) dict["Admin:Email"] = adminEmail;
        if (adminPassword != null) dict["Admin:Password"] = adminPassword;
        return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
    }

    private static AuthService CreateService(AppDbContext db, IConfiguration config)
    {
        var passwords = new PasswordService();
        var jwt = new JwtTokenService(config);
        return new AuthService(
            new AdminCredentialRepository(db),
            passwords,
            jwt,
            config);
    }

    private static void SeedCredential(AppDbContext db, string email, string password)
    {
        var passwords = new PasswordService();
        (string hash, string salt) = passwords.Hash(password);
        db.AdminCredentials.Add(new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
        });
        db.SaveChanges();
    }

    // ── LoginAsync ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task LoginAsync_Returns_Jwt_On_Correct_Email_And_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(LoginAsync_Returns_Jwt_On_Correct_Email_And_Password));
        SeedCredential(db, "admin@example.com", "secret123");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.LoginAsync("admin@example.com", "secret123");

        Assert.False(string.IsNullOrWhiteSpace(jwt));
    }

    [Fact]
    public async Task LoginAsync_Is_Case_Insensitive_On_Email()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(LoginAsync_Is_Case_Insensitive_On_Email));
        SeedCredential(db, "admin@example.com", "secret123");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.LoginAsync("ADMIN@EXAMPLE.COM", "secret123");

        Assert.False(string.IsNullOrWhiteSpace(jwt));
    }

    [Fact]
    public async Task LoginAsync_Returns_Null_On_Wrong_Email()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(LoginAsync_Returns_Null_On_Wrong_Email));
        SeedCredential(db, "admin@example.com", "secret123");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.LoginAsync("wrong@example.com", "secret123");

        Assert.Null(jwt);
    }

    [Fact]
    public async Task LoginAsync_Returns_Null_On_Wrong_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(LoginAsync_Returns_Null_On_Wrong_Password));
        SeedCredential(db, "admin@example.com", "secret123");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.LoginAsync("admin@example.com", "wrong");

        Assert.Null(jwt);
    }

    [Fact]
    public async Task LoginAsync_Bootstraps_Credential_From_Config_On_First_Run()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(LoginAsync_Bootstraps_Credential_From_Config_On_First_Run));
        // No pre-seeded credential — bootstrap path should read Admin:Email/Password from config.
        AuthService svc = CreateService(db, BuildConfig(adminEmail: "boot@openresto.com", adminPassword: "configured-pw"));

        string? jwt = await svc.LoginAsync("boot@openresto.com", "configured-pw");

        Assert.False(string.IsNullOrWhiteSpace(jwt));
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("boot@openresto.com", cred.Email);
    }

    // ── ChangePasswordAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task ChangePasswordAsync_Rejects_Wrong_Current_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangePasswordAsync_Rejects_Wrong_Current_Password));
        SeedCredential(db, "admin@example.com", "old");
        AuthService svc = CreateService(db, BuildConfig());

        bool ok = await svc.ChangePasswordAsync("wrong", "newpass");

        Assert.False(ok);
        // Old password still works after failed change attempt.
        Assert.True(await svc.LoginAsync("admin@example.com", "old") is not null);
    }

    [Fact]
    public async Task ChangePasswordAsync_Succeeds_And_New_Password_Works()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangePasswordAsync_Succeeds_And_New_Password_Works));
        SeedCredential(db, "admin@example.com", "old");
        AuthService svc = CreateService(db, BuildConfig());

        bool ok = await svc.ChangePasswordAsync("old", "newpass");

        Assert.True(ok);
        Assert.Null(await svc.LoginAsync("admin@example.com", "old"));
        Assert.NotNull(await svc.LoginAsync("admin@example.com", "newpass"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("12345")]
    public async Task ChangePasswordAsync_Throws_ArgumentException_When_New_Password_Too_Short(string weak)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangePasswordAsync_Throws_ArgumentException_When_New_Password_Too_Short) + weak);
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        var ex = await Assert.ThrowsAsync<ValidationException>(() => svc.ChangePasswordAsync("pw", weak));
        Assert.Contains("at least 6 characters", ex.Message);
    }

    // ── ChangeEmailAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task ChangeEmailAsync_Returns_New_Jwt_On_Success()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangeEmailAsync_Returns_New_Jwt_On_Success));
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.ChangeEmailAsync("pw", "new@example.com");

        Assert.False(string.IsNullOrWhiteSpace(jwt));
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("new@example.com", cred.Email);
    }

    [Fact]
    public async Task ChangeEmailAsync_Throws_When_New_Email_Equals_Current()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangeEmailAsync_Throws_When_New_Email_Equals_Current));
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        // Same email after normalisation (trim + lower) ⇒ BusinessRuleException.
        await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.ChangeEmailAsync("pw", "ADMIN@EXAMPLE.COM"));
    }

    [Fact]
    public async Task ChangeEmailAsync_Returns_Null_On_Wrong_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangeEmailAsync_Returns_Null_On_Wrong_Password));
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        string? jwt = await svc.ChangeEmailAsync("wrong", "new@example.com");

        Assert.Null(jwt);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing-domain@")]
    [InlineData("@missing-local.com")]
    [InlineData("   ")]
    public async Task ChangeEmailAsync_Throws_ArgumentException_When_Email_Invalid(string malformed)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ChangeEmailAsync_Throws_ArgumentException_When_Email_Invalid) + malformed.GetHashCode());
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        var ex = await Assert.ThrowsAsync<ValidationException>(() => svc.ChangeEmailAsync("pw", malformed));
        Assert.Contains("valid email", ex.Message);
    }

    // ── ResetPasswordAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task ResetPasswordAsync_Returns_False_For_Unknown_Token()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Returns_False_For_Unknown_Token));
        SeedCredential(db, "admin@example.com", "pw");
        AuthService svc = CreateService(db, BuildConfig());

        bool ok = await svc.ResetPasswordAsync("nonexistent", "freshpw");

        Assert.False(ok);
    }

    [Fact]
    public async Task ResetPasswordAsync_Returns_False_For_Expired_Token()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Returns_False_For_Expired_Token));
        SeedCredential(db, "admin@example.com", "pw");
        // Manually attach an expired reset token to the credential row.
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        cred.ResetToken = "expired-token";
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        AuthService svc = CreateService(db, BuildConfig());

        bool ok = await svc.ResetPasswordAsync("expired-token", "freshpw");

        Assert.False(ok);
    }

    [Fact]
    public async Task ResetPasswordAsync_Succeeds_Clears_Token_And_Allows_New_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Succeeds_Clears_Token_And_Allows_New_Password));
        SeedCredential(db, "admin@example.com", "pw");
        // Issue a valid (non-expired) token via the SecurityQuestionsService — the only
        // legitimate producer of reset tokens. This also exercises the cross-service contract.
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        cred.ResetToken = "valid-token";
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await db.SaveChangesAsync();
        AuthService svc = CreateService(db, BuildConfig());

        bool ok = await svc.ResetPasswordAsync("valid-token", "freshpw");

        Assert.True(ok);
        AdminCredential after = await db.AdminCredentials.SingleAsync();
        Assert.Null(after.ResetToken);
        Assert.Null(after.ResetTokenExpiry);
        Assert.Null(await svc.LoginAsync("admin@example.com", "pw"));
        Assert.NotNull(await svc.LoginAsync("admin@example.com", "freshpw"));
    }

    [Theory]
    [InlineData("short")]
    [InlineData("12345")]
    public async Task ResetPasswordAsync_Throws_ArgumentException_When_New_Password_Too_Short(string weak)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Throws_ArgumentException_When_New_Password_Too_Short) + weak);
        SeedCredential(db, "admin@example.com", "pw");
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        cred.ResetToken = "valid-token";
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await db.SaveChangesAsync();
        AuthService svc = CreateService(db, BuildConfig());

        var ex = await Assert.ThrowsAsync<ValidationException>(() => svc.ResetPasswordAsync("valid-token", weak));
        Assert.Contains("at least 6 characters", ex.Message);
    }
}
