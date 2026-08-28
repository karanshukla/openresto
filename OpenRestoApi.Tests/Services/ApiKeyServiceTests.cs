using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using OpenRestoApi.Tests.Holds;

namespace OpenRestoApi.Tests.Services;

public class ApiKeyServiceTests
{
    private static readonly DateTime BaseTime = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);

    private static ApiKeyService CreateService(AppDbContext db, int callerId, FakeClock? clock = null)
        => new(
            new AdminApiKeyRepository(db),
            new FakeCurrentUser { UserId = callerId },
            clock ?? new FakeClock(BaseTime));

    private static AdminCredential SeedUser(AppDbContext db, string email)
    {
        var user = new AdminCredential
        {
            Email = email,
            PasswordHash = "hash",
            PasswordSalt = "salt",
            Role = UserRoles.Owner,
        };
        db.AdminCredentials.Add(user);
        db.SaveChanges();
        return user;
    }

    private static List<ApiKeyScopeDto> BookingsRead() =>
        [new ApiKeyScopeDto { Resource = ApiKeyScopes.Bookings, Access = ApiKeyScopes.Read }];

    private static CreateApiKeyRequest ValidRequest(string name = "CI bot") => new()
    {
        Name = name,
        Scopes = BookingsRead(),
    };

    // ── CreateAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_ReturnsASecretThatParsesAndVerifiesAgainstTheStoredHash()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_ReturnsASecretThatParsesAndVerifiesAgainstTheStoredHash));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        ApiKeyCreatedDto created = await svc.CreateAsync(ValidRequest());

        Assert.True(ApiKeyCrypto.TryParseId(created.Secret, out int parsedId));
        Assert.Equal(created.Id, parsedId);
        AdminApiKey stored = db.AdminApiKeys.Single(k => k.Id == created.Id);
        Assert.True(ApiKeyCrypto.Verify(created.Secret, stored.KeyHash));
        Assert.Equal(stored.Prefix, created.Prefix);
        Assert.StartsWith(created.Prefix, created.Secret, StringComparison.Ordinal);
    }

    [Fact]
    public async Task CreateAsync_PersistsTheRequestedScopes()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_PersistsTheRequestedScopes));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        ApiKeyCreatedDto created = await svc.CreateAsync(ValidRequest());

        ApiKeyScopeDto scope = Assert.Single(created.Scopes);
        Assert.Equal(ApiKeyScopes.Bookings, scope.Resource);
        Assert.Equal(ApiKeyScopes.Read, scope.Access);
    }

    [Fact]
    public async Task CreateAsync_DeduplicatesRepeatedScopePairs()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_DeduplicatesRepeatedScopePairs));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);
        var req = new CreateApiKeyRequest { Name = "dup", Scopes = [.. BookingsRead(), .. BookingsRead()] };

        ApiKeyCreatedDto created = await svc.CreateAsync(req);

        Assert.Single(created.Scopes);
    }

    [Fact]
    public async Task CreateAsync_RejectsAnEmptyName()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsAnEmptyName));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => svc.CreateAsync(ValidRequest(" ")));
        Assert.Equal(ErrorCodes.ApiKeyNameRequired, ex.Code);
    }

    [Fact]
    public async Task CreateAsync_RejectsANameOverTheLengthCap()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsANameOverTheLengthCap));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => svc.CreateAsync(ValidRequest(new string('x', ApiKeyFields.MaxNameLength + 1))));
        Assert.Equal(ErrorCodes.ApiKeyNameTooLong, ex.Code);
    }

    [Fact]
    public async Task CreateAsync_RejectsAnEmptyScopeList()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsAnEmptyScopeList));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => svc.CreateAsync(new CreateApiKeyRequest { Name = "no-scopes", Scopes = [] }));
        Assert.Equal(ErrorCodes.ApiKeyScopesRequired, ex.Code);
    }

    [Fact]
    public async Task CreateAsync_RejectsAnInvalidScopePair()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsAnInvalidScopePair));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);
        var req = new CreateApiKeyRequest
        {
            Name = "bad-scope",
            Scopes = [new ApiKeyScopeDto { Resource = ApiKeyScopes.Audit, Access = ApiKeyScopes.Write }],
        };

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Equal(ErrorCodes.ApiKeyScopeInvalid, ex.Code);
    }

    [Fact]
    public async Task CreateAsync_RejectsAnExpiryInThePast()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_RejectsAnExpiryInThePast));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        var clock = new FakeClock(BaseTime);
        ApiKeyService svc = CreateService(db, owner.Id, clock);
        CreateApiKeyRequest req = ValidRequest();
        req.ExpiresAt = BaseTime.AddMinutes(-1);

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Equal(ErrorCodes.ApiKeyExpiresAtInPast, ex.Code);
    }

    [Fact]
    public async Task CreateAsync_AcceptsAnExpiryInTheFuture()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_AcceptsAnExpiryInTheFuture));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        var clock = new FakeClock(BaseTime);
        ApiKeyService svc = CreateService(db, owner.Id, clock);
        CreateApiKeyRequest req = ValidRequest();
        req.ExpiresAt = BaseTime.AddDays(30);

        ApiKeyCreatedDto created = await svc.CreateAsync(req);

        Assert.Equal(BaseTime.AddDays(30), created.ExpiresAt);
    }

    // ── GetAllAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_OnlyReturnsTheCallingUsersOwnKeys()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_OnlyReturnsTheCallingUsersOwnKeys));
        AdminCredential ownerA = SeedUser(db, "a@example.com");
        AdminCredential ownerB = SeedUser(db, "b@example.com");
        await CreateService(db, ownerA.Id).CreateAsync(ValidRequest("A's key"));
        await CreateService(db, ownerB.Id).CreateAsync(ValidRequest("B's key"));

        List<ApiKeyDto> aKeys = await CreateService(db, ownerA.Id).GetAllAsync();

        ApiKeyDto only = Assert.Single(aKeys);
        Assert.Equal("A's key", only.Name);
    }

    [Fact]
    public async Task GetAllAsync_NeverExposesTheHash()
    {
        // ApiKeyDto has no property that could carry the hash — this pins that assumption at the
        // type level so a future field addition can't reintroduce it silently.
        Assert.DoesNotContain(
            typeof(ApiKeyDto).GetProperties(),
            p => p.Name.Contains("Hash", StringComparison.OrdinalIgnoreCase)
                || p.Name.Contains("Secret", StringComparison.OrdinalIgnoreCase));
    }

    // ── RevokeAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task RevokeAsync_SetsRevokedAt()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RevokeAsync_SetsRevokedAt));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        var clock = new FakeClock(BaseTime);
        ApiKeyService svc = CreateService(db, owner.Id, clock);
        ApiKeyCreatedDto created = await svc.CreateAsync(ValidRequest());

        ApiKeyDto revoked = await svc.RevokeAsync(created.Id);

        Assert.Equal(BaseTime, revoked.RevokedAt);
    }

    [Fact]
    public async Task RevokeAsync_IsIdempotent_SecondCallKeepsTheFirstRevocationTime()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RevokeAsync_IsIdempotent_SecondCallKeepsTheFirstRevocationTime));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        var clock = new FakeClock(BaseTime);
        ApiKeyService svc = CreateService(db, owner.Id, clock);
        ApiKeyCreatedDto created = await svc.CreateAsync(ValidRequest());
        await svc.RevokeAsync(created.Id);

        clock.Advance(TimeSpan.FromHours(1));
        ApiKeyDto secondCall = await svc.RevokeAsync(created.Id);

        Assert.Equal(BaseTime, secondCall.RevokedAt);
    }

    [Fact]
    public async Task RevokeAsync_ThrowsNotFound_ForAKeyOwnedBySomeoneElse()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RevokeAsync_ThrowsNotFound_ForAKeyOwnedBySomeoneElse));
        AdminCredential ownerA = SeedUser(db, "a@example.com");
        AdminCredential ownerB = SeedUser(db, "b@example.com");
        ApiKeyCreatedDto created = await CreateService(db, ownerA.Id).CreateAsync(ValidRequest());
        ApiKeyService svcB = CreateService(db, ownerB.Id);

        NotFoundException ex = await Assert.ThrowsAsync<NotFoundException>(() => svcB.RevokeAsync(created.Id));
        Assert.Equal(ErrorCodes.ApiKeyNotFound, ex.Code);
    }

    [Fact]
    public async Task RevokeAsync_ThrowsNotFound_ForAnUnknownId()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(RevokeAsync_ThrowsNotFound_ForAnUnknownId));
        AdminCredential owner = SeedUser(db, "owner@example.com");
        ApiKeyService svc = CreateService(db, owner.Id);

        await Assert.ThrowsAsync<NotFoundException>(() => svc.RevokeAsync(999));
    }
}
