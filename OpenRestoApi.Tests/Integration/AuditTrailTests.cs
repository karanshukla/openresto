using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// The audit floor, end to end through the real pipeline. These assert the guarantee the
/// middleware exists for: a mutating admin request lands a row whether or not any service said
/// anything about it, a read does not, and a request that was refused is recorded as refused.
/// </summary>
public class AuditTrailTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private async Task<List<AdminAuditEntry>> EntriesAsync()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.AdminAuditEntries.AsNoTracking().OrderBy(e => e.Id).ToListAsync();
    }

    private async Task<int> EntryCountAsync() => (await EntriesAsync()).Count;

    private async Task<AdminCredential> SeedManagerAsync(string email)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        AdminCredential? existing = await db.AdminCredentials.FirstOrDefaultAsync(c => c.Email == email);
        if (existing != null) return existing;

        var passwords = scope.ServiceProvider.GetRequiredService<IPasswordService>();
        (string hash, string salt) = passwords.Hash("seeded-password");
        var manager = new AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            DisplayName = "Casey Manager",
            Role = UserRoles.Manager,
        };
        db.AdminCredentials.Add(manager);
        await db.SaveChangesAsync();
        return manager;
    }

    private async Task<HttpClient> ManagerClientAsync(string email)
    {
        AdminCredential manager = await SeedManagerAsync(email);
        return _factory.CreateClientWithToken(
            TestWebAppFactory.GenerateJwt(manager.Id, manager.Email, manager.Role));
    }

    [Fact]
    public async Task MutatingAdminRequest_LandsAnEntryCarryingTheActorAndTheHttpFacts()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/admin/restaurants", new { name = "Audited Bistro", address = "1 Ledger St" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        AdminAuditEntry entry = (await EntriesAsync())
            .Last(e => e.Path == "/api/admin/restaurants" && e.HttpMethod == "POST");

        Assert.Equal(TestWebAppFactory.AdminEmail, entry.ActorEmail);
        Assert.Equal(_factory.GetSeededAdmin().Id, entry.ActorUserId);
        Assert.Equal(UserRoles.Owner, entry.ActorRole);
        Assert.Equal(StatusCodes.Status201Created, entry.StatusCode);
        Assert.NotEqual(default, entry.OccurredAt);
    }

    /// <summary>
    /// Reads are out of scope for v1. The dashboard polls several of these per minute per open
    /// tab, and a row each would bury the writes the log exists to show.
    /// </summary>
    [Fact]
    public async Task ReadRequest_LandsNoEntry()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        int before = await EntryCountAsync();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/overview")).StatusCode);

        Assert.Equal(before, await EntryCountAsync());
    }

    [Fact]
    public async Task UnauthenticatedMutatingRequest_LandsNoEntry()
    {
        HttpClient client = _factory.CreateClient();
        int before = await EntryCountAsync();

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/admin/restaurants", new { name = "Trespasser" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(before, await EntryCountAsync());
    }

    /// <summary>
    /// A refused attempt is exactly the kind of thing a trail is consulted about, so 4xx rows are
    /// kept rather than filtered out as failures.
    /// </summary>
    [Fact]
    public async Task RefusedAdminRequest_IsRecordedWithTheStatusTheCallerReceived()
    {
        HttpClient manager = await ManagerClientAsync("audit-refused@test.com");

        HttpResponseMessage response = await manager.DeleteAsync("/api/admin/restaurants/999999");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        AdminAuditEntry entry = (await EntriesAsync()).Last(e => e.Path == "/api/admin/restaurants/999999");
        Assert.Equal(StatusCodes.Status403Forbidden, entry.StatusCode);
        Assert.Equal("audit-refused@test.com", entry.ActorEmail);
        Assert.Equal(UserRoles.Manager, entry.ActorRole);
    }

    /// <summary>
    /// The display name is the one identifying field the token does not carry, and an entry
    /// listing a bare address for someone the rest of the admin shows by name reads as a
    /// different person.
    /// </summary>
    [Fact]
    public async Task Entry_CarriesTheActorsDisplayName_WhichTheTokenDoesNotHold()
    {
        HttpClient manager = await ManagerClientAsync("audit-named@test.com");

        await manager.PostAsJsonAsync("/api/admin/restaurants", new { name = "Named Actor Cafe" });

        AdminAuditEntry entry = (await EntriesAsync()).Last(e => e.ActorEmail == "audit-named@test.com");
        Assert.Equal("Casey Manager", entry.ActorDisplayName);
    }

    /// <summary>
    /// The floor: a request that changed nothing at all still lands a row. Coverage does not
    /// depend on anyone having remembered to enrich the endpoint, which is what makes an action
    /// added tomorrow audited today.
    /// </summary>
    [Fact]
    public async Task RequestThatChangedNothing_StillLandsARow()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();

        await client.PostAsJsonAsync("/api/admin/restaurants/999999/pause", new { minutes = 30 });

        AdminAuditEntry entry = (await EntriesAsync()).Last(e => e.Path == "/api/admin/restaurants/999999/pause");
        Assert.False(string.IsNullOrWhiteSpace(entry.Action));
        Assert.Equal(StatusCodes.Status404NotFound, entry.StatusCode);
    }

    [Fact]
    public async Task AuditTrail_IsReadableByAnOwner()
    {
        HttpClient owner = _factory.CreateAuthenticatedClient();
        await owner.PostAsJsonAsync("/api/admin/restaurants", new { name = "Readable Trail" });

        HttpResponseMessage response = await owner.GetAsync("/api/admin/audit?pageSize=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AuditPageResponse? page = await response.Content.ReadFromJsonAsync<AuditPageResponse>();
        Assert.NotNull(page);
        Assert.True(page!.TotalCount > 0);
        Assert.True(page.Items.Count <= 5);
        Assert.Equal(5, page.PageSize);
    }

    /// <summary>
    /// "Who did what" is a management function: a Manager holds a valid session and is still
    /// refused, matching the gate on user management.
    /// </summary>
    [Fact]
    public async Task AuditTrail_IsRefusedToAManager()
    {
        HttpClient manager = await ManagerClientAsync("audit-reader@test.com");

        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync("/api/admin/audit")).StatusCode);
    }

    /// <summary>
    /// Notifications have DELETE; the audit trail deliberately does not. Whether routing answers
    /// 404 or 405 is incidental — what matters is that no caller can remove an entry.
    /// </summary>
    [Fact]
    public async Task AuditTrail_ExposesNoWayToDeleteAnEntry()
    {
        HttpClient owner = _factory.CreateAuthenticatedClient();

        HttpResponseMessage byCollection = await owner.DeleteAsync("/api/admin/audit");
        HttpResponseMessage byId = await owner.DeleteAsync("/api/admin/audit/1");

        Assert.False(byCollection.IsSuccessStatusCode);
        Assert.False(byId.IsSuccessStatusCode);
    }

    [Fact]
    public async Task AuditTrail_FiltersByActionPrefix()
    {
        HttpClient owner = _factory.CreateAuthenticatedClient();
        await owner.PostAsJsonAsync("/api/admin/restaurants", new { name = "Prefix Filter Cafe" });

        HttpResponseMessage response = await owner.GetAsync("/api/admin/audit?action=restaurant&pageSize=100");

        AuditPageResponse? page = await response.Content.ReadFromJsonAsync<AuditPageResponse>();
        Assert.NotNull(page);
        Assert.All(page!.Items, item => Assert.StartsWith("restaurant", item.Action, StringComparison.Ordinal));
    }

    /// <summary>
    /// Signing out is worth recording; clearing a cookie nobody had is not. The endpoint takes
    /// no token by design, so an anonymous POST would otherwise land an actor-less row and could
    /// be repeated to bury the entries that matter.
    /// </summary>
    [Fact]
    public async Task Logout_IsRecordedForASessionAndIgnoredWithoutOne()
    {
        int before = await EntryCountAsync();
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClient().PostAsync("/api/admin/auth/logout", null)).StatusCode);
        Assert.Equal(before, await EntryCountAsync());

        Assert.Equal(HttpStatusCode.OK,
            (await _factory.CreateAuthenticatedClient().PostAsync("/api/admin/auth/logout", null)).StatusCode);

        AdminAuditEntry entry = (await EntriesAsync()).Last();
        Assert.Equal(AuditActions.AuthLogout, entry.Action);
        Assert.Equal(TestWebAppFactory.AdminEmail, entry.ActorEmail);
    }

    /// <summary>
    /// A rejected sign-in records the address that was tried — the point of the entry — and
    /// nothing that would tell the attempt whether that address exists.
    /// </summary>
    [Fact]
    public async Task FailedLogin_RecordsTheAttemptedAddressButNotThePassword()
    {
        const string password = "definitely-not-the-password";
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/admin/auth/login", new { email = "ghost@test.com", password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        AdminAuditEntry entry = (await EntriesAsync()).Last(e => e.Action == AuditActions.AuthLoginFailed);
        Assert.Equal("ghost@test.com", entry.ActorEmail);
        Assert.Null(entry.ActorUserId);
        Assert.Equal(StatusCodes.Status401Unauthorized, entry.StatusCode);
        Assert.DoesNotContain(password, entry.ChangesJson ?? string.Empty, StringComparison.Ordinal);
        Assert.DoesNotContain(password, entry.Summary ?? string.Empty, StringComparison.Ordinal);
    }

    /// <summary>
    /// One pass over every endpoint that accepts a secret, each given a value that appears
    /// nowhere else, asserting none of them turns up in the trail. Written as a sweep rather
    /// than a test per endpoint because the guarantee is a property of the whole surface: adding
    /// a credential-bearing endpoint and forgetting it is exactly the failure this catches.
    /// </summary>
    [Fact]
    public async Task NoSecretSuppliedToAnyEndpoint_EverReachesTheTrail()
    {
        const string stamp = "aud1t5weep";
        string Secret(string label) => $"{stamp}-{label}";

        HttpClient owner = _factory.CreateAuthenticatedClient();
        AdminCredential manager = await SeedManagerAsync("audit-sweep@test.com");
        HttpClient managerClient = _factory.CreateClientWithToken(
            TestWebAppFactory.GenerateJwt(manager.Id, manager.Email, manager.Role));

        HttpResponseMessage created = await owner.PostAsJsonAsync(
            "/api/admin/restaurants", new { name = "Sweep Cafe" });
        int restaurantId = (await created.Content.ReadFromJsonAsync<RestaurantIdResponse>())!.Id;

        // A rejected sign-in still carries what was typed into the password box.
        await _factory.CreateClient().PostAsJsonAsync(
            "/api/admin/auth/login", new { email = "sweep@test.com", password = Secret("login") });

        // The question narrows a guess at the answer, so neither is recordable.
        await managerClient.PostAsJsonAsync("/api/admin/auth/pvq/setup",
            new { question = Secret("question"), answer = Secret("answer") });

        await managerClient.PostAsJsonAsync("/api/admin/auth/change-password",
            new { currentPassword = "seeded-password", newPassword = Secret("newpass") });

        HttpResponseMessage invited = await owner.PostAsJsonAsync("/api/admin/users", new
        {
            email = $"audit-sweep-invitee-{Guid.NewGuid():N}@test.com",
            password = Secret("invite"),
            displayName = "Sweep Invitee",
            role = UserRoles.Manager,
        });
        Assert.Equal(HttpStatusCode.Created, invited.StatusCode);

        await owner.PostAsJsonAsync($"/api/admin/users/{manager.Id}/reset-password",
            new { newPassword = Secret("reset") });

        await owner.PatchAsJsonAsync("/api/admin/email-settings", new
        {
            host = "smtp.example.com",
            port = 587,
            username = "mailer@example.com",
            password = Secret("smtp"),
            enableSsl = true,
            fromName = "Audited",
            fromEmail = "mailer@example.com",
            sendBookingConfirmations = false,
        });

        await owner.PostAsJsonAsync($"/api/admin/push/subscribe?restaurantId={restaurantId}", new
        {
            endpoint = $"https://push.example.com/{Secret("endpoint")}",
            p256dh = Secret("p256dh"),
            auth = Secret("pushauth"),
        });

        List<AdminAuditEntry> entries = await EntriesAsync();

        // Every one of those requests landed a row — the sweep would pass vacuously otherwise.
        foreach (string path in new[]
        {
            "/api/admin/auth/login", "/api/admin/auth/pvq/setup", "/api/admin/auth/change-password",
            "/api/admin/users", "/api/admin/email-settings", "/api/admin/push/subscribe",
        })
        {
            Assert.Contains(entries, e => e.Path == path);
        }

        Assert.All(entries, e =>
        {
            string haystack = string.Join(' ',
                e.ChangesJson, e.Summary, e.TargetLabel, e.TargetId, e.ActorDisplayName, e.Path);
            Assert.DoesNotContain(stamp, haystack, StringComparison.OrdinalIgnoreCase);
        });
    }

    private sealed class RestaurantIdResponse
    {
        public int Id { get; set; }
    }

    private sealed class AuditPageResponse
    {
        public List<AuditItem> Items { get; set; } = [];
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    private sealed class AuditItem
    {
        public int Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string ActorEmail { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public int StatusCode { get; set; }
    }
}
