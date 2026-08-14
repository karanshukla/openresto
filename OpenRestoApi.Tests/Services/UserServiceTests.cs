using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class UserServiceTests
{
    private static UserService CreateService(AppDbContext db, ICurrentUserService? currentUser = null)
        => new(
            new AdminCredentialRepository(db),
            new PasswordService(),
            currentUser ?? FakeCurrentUser.Anonymous());

    private static AdminCredential Seed(
        AppDbContext db,
        string email,
        string role = UserRoles.Owner,
        bool isActive = true)
    {
        var passwords = new PasswordService();
        (string hash, string salt) = passwords.Hash("seeded-password");
        var cred = new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = role,
            IsActive = isActive,
        };
        db.AdminCredentials.Add(cred);
        db.SaveChanges();
        return cred;
    }

    private static CreateUserRequest ValidRequest(string email = "new@example.com") => new()
    {
        Email = email,
        Password = "temp-password",
        DisplayName = "New Person",
        Role = UserRoles.Manager,
    };

    // ── GetAllAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_Returns_Every_Account_Without_Secrets()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_Returns_Every_Account_Without_Secrets));
        Seed(db, "owner@example.com");
        Seed(db, "manager@example.com", UserRoles.Manager, isActive: false);
        UserService svc = CreateService(db);

        List<UserDto> users = await svc.GetAllAsync();

        Assert.Equal(2, users.Count);
        Assert.Equal(["owner@example.com", "manager@example.com"], users.Select(u => u.Email));
        Assert.False(users[1].IsActive);
        // UserDto has no password/PVQ surface at all — verified by the type, asserted here
        // so a future field addition has to make a deliberate choice.
        Assert.DoesNotContain("Password", typeof(UserDto).GetProperties().Select(p => p.Name));
    }

    // ── CreateAsync ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_Persists_A_Normalised_Active_Account()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Persists_A_Normalised_Active_Account));
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest("  NewPerson@Example.COM ");
        req.DisplayName = "  New Person  ";
        UserDto created = await svc.CreateAsync(req);

        Assert.Equal("newperson@example.com", created.Email);
        Assert.Equal("New Person", created.DisplayName);
        Assert.Equal(UserRoles.Manager, created.Role);
        Assert.True(created.IsActive);
        Assert.False(created.HasSecurityQuestion);
        AdminCredential stored = await db.AdminCredentials.SingleAsync();
        Assert.True(new PasswordService().Verify("temp-password", stored.PasswordHash, stored.PasswordSalt));
    }

    [Fact]
    public async Task CreateAsync_Allows_A_Blank_Display_Name()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Allows_A_Blank_Display_Name));
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest();
        req.DisplayName = "   ";
        UserDto created = await svc.CreateAsync(req);

        Assert.Null(created.DisplayName);
    }

    [Fact]
    public async Task CreateAsync_Rejects_A_Duplicate_Email_Regardless_Of_Case()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Rejects_A_Duplicate_Email_Regardless_Of_Case));
        Seed(db, "taken@example.com");
        UserService svc = CreateService(db);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.CreateAsync(ValidRequest("TAKEN@example.com")));
        Assert.Contains("already exists", ex.Message);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("   ")]
    public async Task CreateAsync_Rejects_A_Malformed_Email(string email)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Rejects_A_Malformed_Email) + email.GetHashCode());
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(ValidRequest(email)));
    }

    [Fact]
    public async Task CreateAsync_Rejects_A_Short_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Rejects_A_Short_Password));
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest();
        req.Password = "12345";
        var ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("at least 6 characters", ex.Message);
    }

    [Theory]
    [InlineData("Superuser")]
    [InlineData("")]
    [InlineData("Admin")] // the retired claim value is not an assignable role
    public async Task CreateAsync_Rejects_A_Role_Outside_The_Allow_List(string role)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Rejects_A_Role_Outside_The_Allow_List) + role);
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest();
        req.Role = role;
        var ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Contains("Role must be one of", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_Accepts_A_Role_In_Any_Casing_And_Stores_It_Canonically()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Accepts_A_Role_In_Any_Casing_And_Stores_It_Canonically));
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest();
        req.Role = "mAnAgEr";
        UserDto created = await svc.CreateAsync(req);

        Assert.Equal(UserRoles.Manager, created.Role);
    }

    [Fact]
    public async Task CreateAsync_Rejects_An_Overlong_Display_Name()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_Rejects_An_Overlong_Display_Name));
        UserService svc = CreateService(db);

        CreateUserRequest req = ValidRequest();
        req.DisplayName = new string('x', UserFields.MaxDisplayNameLength + 1);
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
    }

    // ── UpdateRoleAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRoleAsync_Promotes_A_Manager()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Promotes_A_Manager));
        Seed(db, "owner@example.com");
        AdminCredential manager = Seed(db, "manager@example.com", UserRoles.Manager);
        UserService svc = CreateService(db);

        UserDto updated = await svc.UpdateRoleAsync(manager.Id, new UpdateUserRoleRequest { Role = UserRoles.Owner });

        Assert.Equal(UserRoles.Owner, updated.Role);
    }

    [Fact]
    public async Task UpdateRoleAsync_Demotes_An_Owner_When_Another_Active_One_Remains()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Demotes_An_Owner_When_Another_Active_One_Remains));
        AdminCredential first = Seed(db, "owner1@example.com");
        Seed(db, "owner2@example.com");
        UserService svc = CreateService(db);

        UserDto updated = await svc.UpdateRoleAsync(first.Id, new UpdateUserRoleRequest { Role = UserRoles.Manager });

        Assert.Equal(UserRoles.Manager, updated.Role);
    }

    [Fact]
    public async Task UpdateRoleAsync_Refuses_To_Demote_The_Last_Active_Owner()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Refuses_To_Demote_The_Last_Active_Owner));
        AdminCredential owner = Seed(db, "owner@example.com");
        Seed(db, "manager@example.com", UserRoles.Manager);
        UserService svc = CreateService(db);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.UpdateRoleAsync(owner.Id, new UpdateUserRoleRequest { Role = UserRoles.Manager }));
        Assert.Contains("last active Owner", ex.Message);
        Assert.Equal(UserRoles.Owner, (await db.AdminCredentials.SingleAsync(c => c.Id == owner.Id)).Role);
    }

    [Fact]
    public async Task UpdateRoleAsync_Does_Not_Count_A_Deactivated_Owner_As_Cover()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Does_Not_Count_A_Deactivated_Owner_As_Cover));
        AdminCredential active = Seed(db, "owner@example.com");
        Seed(db, "dormant@example.com", UserRoles.Owner, isActive: false);
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.UpdateRoleAsync(active.Id, new UpdateUserRoleRequest { Role = UserRoles.Manager }));
    }

    [Fact]
    public async Task UpdateRoleAsync_Is_A_No_Op_When_The_Role_Is_Unchanged()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Is_A_No_Op_When_The_Role_Is_Unchanged));
        AdminCredential owner = Seed(db, "owner@example.com");
        UserService svc = CreateService(db);

        // Re-asserting the current role must not trip the last-Owner guard.
        UserDto updated = await svc.UpdateRoleAsync(owner.Id, new UpdateUserRoleRequest { Role = UserRoles.Owner });

        Assert.Equal(UserRoles.Owner, updated.Role);
    }

    [Fact]
    public async Task UpdateRoleAsync_Throws_NotFound_For_An_Unknown_Id()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateRoleAsync_Throws_NotFound_For_An_Unknown_Id));
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<NotFoundException>(
            () => svc.UpdateRoleAsync(404, new UpdateUserRoleRequest { Role = UserRoles.Manager }));
    }

    // ── SetActiveAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SetActiveAsync_Deactivates_And_Reactivates()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Deactivates_And_Reactivates));
        AdminCredential caller = Seed(db, "owner@example.com");
        AdminCredential manager = Seed(db, "manager@example.com", UserRoles.Manager);
        UserService svc = CreateService(db, FakeCurrentUser.For(caller));

        Assert.False((await svc.SetActiveAsync(manager.Id, new SetUserActiveRequest { IsActive = false })).IsActive);
        Assert.True((await svc.SetActiveAsync(manager.Id, new SetUserActiveRequest { IsActive = true })).IsActive);
    }

    [Fact]
    public async Task SetActiveAsync_Refuses_To_Deactivate_The_Caller()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Refuses_To_Deactivate_The_Caller));
        AdminCredential caller = Seed(db, "owner1@example.com");
        Seed(db, "owner2@example.com");
        UserService svc = CreateService(db, FakeCurrentUser.For(caller));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.SetActiveAsync(caller.Id, new SetUserActiveRequest { IsActive = false }));
        Assert.Contains("your own account", ex.Message);
    }

    [Fact]
    public async Task SetActiveAsync_Recognises_The_Caller_By_Email_On_A_Pre_MultiUser_Token()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Recognises_The_Caller_By_Email_On_A_Pre_MultiUser_Token));
        AdminCredential caller = Seed(db, "legacy@example.com");
        Seed(db, "owner2@example.com");
        UserService svc = CreateService(db, FakeCurrentUser.ForLegacyToken("legacy@example.com"));

        await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.SetActiveAsync(caller.Id, new SetUserActiveRequest { IsActive = false }));
    }

    [Fact]
    public async Task SetActiveAsync_Refuses_To_Deactivate_The_Last_Active_Owner()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Refuses_To_Deactivate_The_Last_Active_Owner));
        AdminCredential owner = Seed(db, "owner@example.com");
        AdminCredential manager = Seed(db, "manager@example.com", UserRoles.Manager);
        UserService svc = CreateService(db, FakeCurrentUser.For(manager));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => svc.SetActiveAsync(owner.Id, new SetUserActiveRequest { IsActive = false }));
        Assert.Contains("last active Owner", ex.Message);
    }

    [Fact]
    public async Task SetActiveAsync_Is_A_No_Op_When_Already_In_The_Requested_State()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Is_A_No_Op_When_Already_In_The_Requested_State));
        AdminCredential owner = Seed(db, "owner@example.com");
        UserService svc = CreateService(db, FakeCurrentUser.For(owner));

        // Re-asserting "active" on the sole Owner (and on yourself) must not trip either guard.
        Assert.True((await svc.SetActiveAsync(owner.Id, new SetUserActiveRequest { IsActive = true })).IsActive);
    }

    [Fact]
    public async Task SetActiveAsync_Throws_NotFound_For_An_Unknown_Id()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(SetActiveAsync_Throws_NotFound_For_An_Unknown_Id));
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<NotFoundException>(
            () => svc.SetActiveAsync(404, new SetUserActiveRequest { IsActive = false }));
    }

    // ── ResetPasswordAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task ResetPasswordAsync_Sets_The_New_Password_And_Clears_Any_Reset_Token()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Sets_The_New_Password_And_Clears_Any_Reset_Token));
        AdminCredential user = Seed(db, "manager@example.com", UserRoles.Manager);
        user.ResetToken = "outstanding";
        user.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await db.SaveChangesAsync();
        UserService svc = CreateService(db);

        await svc.ResetPasswordAsync(user.Id, new ResetUserPasswordRequest { NewPassword = "issued-by-owner" });

        AdminCredential after = await db.AdminCredentials.SingleAsync(c => c.Id == user.Id);
        Assert.True(new PasswordService().Verify("issued-by-owner", after.PasswordHash, after.PasswordSalt));
        Assert.Null(after.ResetToken);
        Assert.Null(after.ResetTokenExpiry);
    }

    [Fact]
    public async Task ResetPasswordAsync_Rejects_A_Short_Password()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Rejects_A_Short_Password));
        AdminCredential user = Seed(db, "manager@example.com", UserRoles.Manager);
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(
            () => svc.ResetPasswordAsync(user.Id, new ResetUserPasswordRequest { NewPassword = "123" }));
    }

    [Fact]
    public async Task ResetPasswordAsync_Throws_NotFound_For_An_Unknown_Id()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(ResetPasswordAsync_Throws_NotFound_For_An_Unknown_Id));
        UserService svc = CreateService(db);

        await Assert.ThrowsAsync<NotFoundException>(
            () => svc.ResetPasswordAsync(404, new ResetUserPasswordRequest { NewPassword = "long-enough" }));
    }
}
