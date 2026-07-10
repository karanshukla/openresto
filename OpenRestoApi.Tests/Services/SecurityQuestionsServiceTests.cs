using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class SecurityQuestionsServiceTests
{
    private static (SecurityQuestionsService svc, IPasswordService passwords) CreateService(AppDbContext db, IConfiguration? config = null)
    {
        var passwords = new PasswordService();
        config ??= new ConfigurationBuilder().Build(); // empty config — env-var fallback in bootstrap
        var svc = new SecurityQuestionsService(
            new AdminCredentialRepository(db),
            passwords,
            config);
        return (svc, passwords);
    }

    private static void SeedCredential(AppDbContext db, string email = "admin@openresto.com")
    {
        var passwords = new PasswordService();
        (string hash, string salt) = passwords.Hash("bootstrap-password");
        db.AdminCredentials.Add(new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
        });
        db.SaveChanges();
    }

    // ── GetStatusAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStatusAsync_When_No_Credential_Returns_Not_Configured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_When_No_Credential_Returns_Not_Configured));
        (SecurityQuestionsService svc, _) = CreateService(db);

        var status = await svc.GetStatusAsync();

        Assert.False(status.IsConfigured);
        Assert.Null(status.Question);
    }

    [Fact]
    public async Task GetStatusAsync_When_No_Pvq_Set_Returns_Not_Configured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_When_No_Pvq_Set_Returns_Not_Configured));
        SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db);

        var status = await svc.GetStatusAsync();

        Assert.False(status.IsConfigured);
        Assert.Null(status.Question);
    }

    // ── SetupAsync ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task SetupAsync_Persists_Normalised_Answer_Hash_And_Question()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Persists_Normalised_Answer_Hash_And_Question));
        SeedCredential(db);
        (SecurityQuestionsService svc, var passwords) = CreateService(db);

        await svc.SetupAsync("  What is your favourite colour?  ", "  Blue  ");

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("What is your favourite colour?", cred.PvqQuestion);
        Assert.NotNull(cred.PvqAnswerHash);
        Assert.NotNull(cred.PvqAnswerSalt);
        // Normalised answer verifies under the canonical password service.
        Assert.True(passwords.Verify("blue", cred.PvqAnswerHash!, cred.PvqAnswerSalt!));
    }

    [Fact]
    public async Task SetupAsync_CreatesCredential_UsingConfigValues_WhenNoneExists()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_CreatesCredential_UsingConfigValues_WhenNoneExists));
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Admin:Email"] = "config@openresto.com",
                ["Admin:Password"] = "config-password",
            })
            .Build();
        (SecurityQuestionsService svc, IPasswordService passwords) = CreateService(db, config);

        await svc.SetupAsync("Q?", "A");

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("config@openresto.com", cred.Email);
        Assert.True(passwords.Verify("config-password", cred.PasswordHash, cred.PasswordSalt));
    }

    [Fact]
    public async Task SetupAsync_CreatesCredential_UsingEnvVarFallback_WhenConfigMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_CreatesCredential_UsingEnvVarFallback_WhenConfigMissing));
        (SecurityQuestionsService svc, _) = CreateService(db);

        Environment.SetEnvironmentVariable("ADMIN_EMAIL", "env@openresto.com");
        Environment.SetEnvironmentVariable("ADMIN_PASSWORD", "env-password");
        try
        {
            await svc.SetupAsync("Q?", "A");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_EMAIL", null);
            Environment.SetEnvironmentVariable("ADMIN_PASSWORD", null);
        }

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("env@openresto.com", cred.Email);
    }

    [Fact]
    public async Task SetupAsync_UsesDefaultEmail_WhenConfigAndEnvVarEmailMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_UsesDefaultEmail_WhenConfigAndEnvVarEmailMissing));
        (SecurityQuestionsService svc, _) = CreateService(db);

        Environment.SetEnvironmentVariable("ADMIN_PASSWORD", "env-password");
        try
        {
            await svc.SetupAsync("Q?", "A");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ADMIN_PASSWORD", null);
        }

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("admin@openresto.com", cred.Email);
    }

    [Fact]
    public async Task SetupAsync_Throws_WhenNoCredentialExists_AndNoPasswordConfigured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Throws_WhenNoCredentialExists_AndNoPasswordConfigured));
        (SecurityQuestionsService svc, _) = CreateService(db);

        Environment.SetEnvironmentVariable("ADMIN_PASSWORD", null);
        await Assert.ThrowsAsync<InfrastructureException>(() => svc.SetupAsync("Q?", "A"));
    }

    // ── VerifyAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task VerifyAsync_Returns_NotConfigured_When_No_Pvq()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_NotConfigured_When_No_Pvq));
        SeedCredential(db, "admin@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db);

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "anything");

        Assert.Equal(PvqVerifyStatus.NotConfigured, outcome.Status);
        Assert.Null(outcome.ResetToken);
    }

    [Fact]
    public async Task VerifyAsync_Returns_WrongAnswer_When_Answer_Mismatched()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_WrongAnswer_When_Answer_Mismatched));
        SeedCredential(db, "admin@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db);
        await svc.SetupAsync("Q?", "Correct");

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "wrong");

        Assert.Equal(PvqVerifyStatus.WrongAnswer, outcome.Status);
        Assert.Null(outcome.ResetToken);
    }

    [Fact]
    public async Task VerifyAsync_Returns_Success_And_Mints_Reset_Token_On_Correct_Answer()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_Success_And_Mints_Reset_Token_On_Correct_Answer));
        SeedCredential(db, "admin@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db);
        await svc.SetupAsync("Q?", "answer");

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "ANSWER");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
        Assert.False(string.IsNullOrWhiteSpace(outcome.ResetToken));
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal(outcome.ResetToken, cred.ResetToken);
        Assert.NotNull(cred.ResetTokenExpiry);
    }

    [Fact]
    public async Task VerifyAsync_Token_Expiry_Is_15_Minutes_From_Now()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Token_Expiry_Is_15_Minutes_From_Now));
        SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db);
        await svc.SetupAsync("Q?", "a");
        DateTime before = DateTime.UtcNow;

        await svc.VerifyAsync("admin@openresto.com", "a");

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.InRange(cred.ResetTokenExpiry!.Value, before.AddMinutes(15).AddSeconds(-5), before.AddMinutes(15).AddSeconds(5));
    }
}
