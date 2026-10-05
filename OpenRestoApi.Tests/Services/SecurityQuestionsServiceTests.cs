using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class SecurityQuestionsServiceTests
{
    private static (SecurityQuestionsService svc, IPasswordService passwords) CreateService(
        AppDbContext db, ICurrentUserService? currentUser = null)
    {
        var passwords = new PasswordService();
        var svc = new SecurityQuestionsService(
            new AdminCredentialRepository(db),
            passwords,
            currentUser ?? FakeCurrentUser.Anonymous());
        return (svc, passwords);
    }

    private static AdminCredential SeedCredential(
        AppDbContext db, string email = "admin@openresto.com", bool isActive = true)
    {
        var passwords = new PasswordService();
        (string hash, string salt) = passwords.Hash("bootstrap-password");
        var cred = new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = UserRoles.Owner,
            IsActive = isActive,
        };
        db.AdminCredentials.Add(cred);
        db.SaveChanges();
        return cred;
    }

    // ── GetStatusAsync (public, email-keyed) ────────────────────────────────────

    [Fact]
    public async Task GetStatusAsync_When_No_Credential_Returns_Not_Configured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_When_No_Credential_Returns_Not_Configured));
        (SecurityQuestionsService svc, _) = CreateService(db);

        PvqStatusDto status = await svc.GetStatusAsync("nobody@openresto.com");

        Assert.False(status.IsConfigured);
        Assert.Null(status.Question);
    }

    [Fact]
    public async Task GetStatusAsync_With_Blank_Email_Returns_Not_Configured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_With_Blank_Email_Returns_Not_Configured));
        AdminCredential cred = SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", "a");

        PvqStatusDto status = await svc.GetStatusAsync("   ");

        Assert.False(status.IsConfigured);
    }

    [Fact]
    public async Task GetStatusAsync_When_No_Pvq_Set_Returns_Not_Configured()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_When_No_Pvq_Set_Returns_Not_Configured));
        SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db);

        PvqStatusDto status = await svc.GetStatusAsync("admin@openresto.com");

        Assert.False(status.IsConfigured);
        Assert.Null(status.Question);
    }

    [Fact]
    public async Task GetStatusAsync_Returns_The_Question_Of_The_Named_Account_Only()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_Returns_The_Question_Of_The_Named_Account_Only));
        AdminCredential owner = SeedCredential(db, "owner@openresto.com");
        AdminCredential manager = SeedCredential(db, "manager@openresto.com");
        (SecurityQuestionsService ownerSvc, _) = CreateService(db, FakeCurrentUser.For(owner));
        (SecurityQuestionsService managerSvc, _) = CreateService(db, FakeCurrentUser.For(manager));
        await ownerSvc.SetupAsync("Owner question?", "a");
        await managerSvc.SetupAsync("Manager question?", "b");

        Assert.Equal("Owner question?", (await ownerSvc.GetStatusAsync("owner@openresto.com")).Question);
        Assert.Equal("Manager question?", (await ownerSvc.GetStatusAsync("manager@openresto.com")).Question);
    }

    [Fact]
    public async Task GetStatusAsync_Hides_The_Question_Of_A_Deactivated_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusAsync_Hides_The_Question_Of_A_Deactivated_Account));
        AdminCredential dormant = SeedCredential(db, "dormant@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(dormant));
        await svc.SetupAsync("Dormant question?", "a");
        dormant.IsActive = false;
        await db.SaveChangesAsync();

        // VerifyAsync would refuse this account, so offering its question would be a dead end.
        PvqStatusDto status = await svc.GetStatusAsync("dormant@openresto.com");

        Assert.False(status.IsConfigured);
        Assert.Null(status.Question);
    }

    // ── GetStatusForCurrentUserAsync ────────────────────────────────────────────

    [Fact]
    public async Task GetStatusForCurrentUserAsync_Returns_The_Callers_Own_Question()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusForCurrentUserAsync_Returns_The_Callers_Own_Question));
        SeedCredential(db, "owner@openresto.com");
        AdminCredential manager = SeedCredential(db, "manager@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(manager));
        await svc.SetupAsync("Manager question?", "b");

        PvqStatusDto status = await svc.GetStatusForCurrentUserAsync();

        Assert.True(status.IsConfigured);
        Assert.Equal("Manager question?", status.Question);
    }

    [Fact]
    public async Task GetStatusForCurrentUserAsync_Returns_Not_Configured_When_Unauthenticated()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetStatusForCurrentUserAsync_Returns_Not_Configured_When_Unauthenticated));
        SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db);

        PvqStatusDto status = await svc.GetStatusForCurrentUserAsync();

        Assert.False(status.IsConfigured);
    }

    // ── SetupAsync ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task SetupAsync_Persists_Normalised_Answer_Hash_And_Question()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Persists_Normalised_Answer_Hash_And_Question));
        AdminCredential seeded = SeedCredential(db);
        (SecurityQuestionsService svc, IPasswordService passwords) = CreateService(db, FakeCurrentUser.For(seeded));

        await svc.SetupAsync("  What is your favourite colour?  ", "  Blue  ");

        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        Assert.Equal("What is your favourite colour?", cred.PvqQuestion);
        Assert.NotNull(cred.PvqAnswerHash);
        Assert.NotNull(cred.PvqAnswerSalt);
        // Normalised answer verifies under the canonical password service.
        Assert.True(passwords.Verify("blue", cred.PvqAnswerHash!, cred.PvqAnswerSalt!));
    }

    [Fact]
    public async Task SetupAsync_Targets_The_Caller_Not_The_First_Row()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Targets_The_Caller_Not_The_First_Row));
        AdminCredential owner = SeedCredential(db, "owner@openresto.com");
        AdminCredential manager = SeedCredential(db, "manager@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(manager));

        await svc.SetupAsync("Manager question?", "b");

        Assert.Null((await db.AdminCredentials.SingleAsync(c => c.Id == owner.Id)).PvqQuestion);
        Assert.Equal("Manager question?", (await db.AdminCredentials.SingleAsync(c => c.Id == manager.Id)).PvqQuestion);
    }

    [Fact]
    public async Task SetupAsync_Resolves_Caller_By_Email_For_Tokens_Without_A_User_Id()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Resolves_Caller_By_Email_For_Tokens_Without_A_User_Id));
        SeedCredential(db, "legacy@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.ForLegacyToken("legacy@openresto.com"));

        await svc.SetupAsync("Q?", "a");

        Assert.Equal("Q?", (await db.AdminCredentials.SingleAsync()).PvqQuestion);
    }

    [Fact]
    public async Task SetupAsync_Throws_When_The_Session_Names_No_Live_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Throws_When_The_Session_Names_No_Live_Account));
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.ForLegacyToken("ghost@openresto.com"));

        await Assert.ThrowsAsync<NotFoundException>(() => svc.SetupAsync("Q?", "A"));
    }

    [Fact]
    public async Task SetupAsync_Throws_For_A_Deactivated_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetupAsync_Throws_For_A_Deactivated_Account));
        AdminCredential cred = SeedCredential(db, "disabled@openresto.com", isActive: false);
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));

        await Assert.ThrowsAsync<NotFoundException>(() => svc.SetupAsync("Q?", "A"));
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
    public async Task VerifyAsync_Returns_NotConfigured_For_A_Deactivated_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_NotConfigured_For_A_Deactivated_Account));
        AdminCredential cred = SeedCredential(db, "disabled@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", "answer");
        cred.IsActive = false;
        await db.SaveChangesAsync();

        PvqVerifyOutcome outcome = await svc.VerifyAsync("disabled@openresto.com", "answer");

        Assert.Equal(PvqVerifyStatus.NotConfigured, outcome.Status);
    }

    [Fact]
    public async Task VerifyAsync_Returns_WrongAnswer_When_Answer_Mismatched()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_WrongAnswer_When_Answer_Mismatched));
        AdminCredential cred = SeedCredential(db, "admin@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", "Correct");

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "wrong");

        Assert.Equal(PvqVerifyStatus.WrongAnswer, outcome.Status);
        Assert.Null(outcome.ResetToken);
    }

    [Fact]
    public async Task VerifyAsync_Returns_Success_And_Mints_Reset_Token_On_Correct_Answer()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Returns_Success_And_Mints_Reset_Token_On_Correct_Answer));
        AdminCredential cred = SeedCredential(db, "admin@openresto.com");
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", "answer");

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "ANSWER");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
        Assert.False(string.IsNullOrWhiteSpace(outcome.ResetToken));
        AdminCredential after = await db.AdminCredentials.SingleAsync();
        Assert.Equal(outcome.ResetToken, after.ResetToken);
        Assert.NotNull(after.ResetTokenExpiry);
    }

    [Fact]
    public async Task VerifyAsync_Token_Expiry_Is_15_Minutes_From_Now()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Token_Expiry_Is_15_Minutes_From_Now));
        AdminCredential cred = SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", "a");
        DateTime before = DateTime.UtcNow;

        await svc.VerifyAsync("admin@openresto.com", "a");

        AdminCredential after = await db.AdminCredentials.SingleAsync();
        Assert.InRange(after.ResetTokenExpiry!.Value, before.AddMinutes(15).AddSeconds(-5), before.AddMinutes(15).AddSeconds(5));
    }

    // ── VerifyAsync lockout ─────────────────────────────────────────────────────

    private static async Task<SecurityQuestionsService> ServiceWithAnswerAsync(AppDbContext db, string answer)
    {
        AdminCredential cred = SeedCredential(db);
        (SecurityQuestionsService svc, _) = CreateService(db, FakeCurrentUser.For(cred));
        await svc.SetupAsync("Q?", answer);
        return svc;
    }

    private static async Task AnswerWrongAsync(SecurityQuestionsService svc, int times)
    {
        for (int i = 0; i < times; i++)
            await svc.VerifyAsync("admin@openresto.com", "wrong");
    }

    [Fact]
    public async Task VerifyAsync_Allows_Attempts_Up_To_The_Limit()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Allows_Attempts_Up_To_The_Limit));
        SecurityQuestionsService svc = await ServiceWithAnswerAsync(db, "answer");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts - 1);

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "answer");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
    }

    [Fact]
    public async Task VerifyAsync_Locks_The_Account_After_Too_Many_Wrong_Answers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Locks_The_Account_After_Too_Many_Wrong_Answers));
        SecurityQuestionsService svc = await ServiceWithAnswerAsync(db, "answer");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts);

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "answer");

        Assert.Equal(PvqVerifyStatus.LockedOut, outcome.Status);
        Assert.Null(outcome.ResetToken);
        Assert.Null((await db.AdminCredentials.SingleAsync()).ResetToken);
    }

    [Fact]
    public async Task VerifyAsync_Accepts_Answers_Again_Once_The_Lockout_Expires()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Accepts_Answers_Again_Once_The_Lockout_Expires));
        SecurityQuestionsService svc = await ServiceWithAnswerAsync(db, "answer");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts);
        AdminCredential cred = await db.AdminCredentials.SingleAsync();
        cred.PvqLockedUntil = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "answer");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
        Assert.Null(cred.PvqLockedUntil);
    }

    [Fact]
    public async Task VerifyAsync_Correct_Answer_Resets_The_Failure_Count()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Correct_Answer_Resets_The_Failure_Count));
        SecurityQuestionsService svc = await ServiceWithAnswerAsync(db, "answer");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts - 1);
        await svc.VerifyAsync("admin@openresto.com", "answer");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts - 1);

        PvqVerifyOutcome outcome = await svc.VerifyAsync("admin@openresto.com", "answer");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
    }

    [Fact]
    public async Task VerifyAsync_Lockout_Is_Per_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(VerifyAsync_Lockout_Is_Per_Account));
        SecurityQuestionsService svc = await ServiceWithAnswerAsync(db, "answer");
        AdminCredential other = SeedCredential(db, "other@openresto.com");
        (SecurityQuestionsService otherSvc, _) = CreateService(db, FakeCurrentUser.For(other));
        await otherSvc.SetupAsync("Q?", "other");
        await AnswerWrongAsync(svc, SecurityQuestionsService.MaxFailedAttempts);

        PvqVerifyOutcome outcome = await svc.VerifyAsync("other@openresto.com", "other");

        Assert.Equal(PvqVerifyStatus.Success, outcome.Status);
    }
}
