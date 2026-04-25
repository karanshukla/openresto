using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class TestWebAppFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin@test.com";
    public const string AdminPassword = "TestPass123!";
    public const string JwtKey = "test-jwt-signing-key-for-integration-tests-minimum-32-chars!!";
    public const string JwtIssuer = "openresto-api";
    public const string JwtAudience = "openresto-admin";

    // Keep the connection open for the lifetime of the factory so the in-memory SQLite DB persists
    private readonly SqliteConnection _connection;

    public TestWebAppFactory()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove ALL DbContext-related registrations
            var descriptorsToRemove = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                    d.ServiceType == typeof(DbContextOptions) ||
                    d.ServiceType == typeof(AppDbContext))
                .ToList();

            foreach (ServiceDescriptor? descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            // Use SQLite in-memory (not EF InMemory) so ExecuteSqlRaw works
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseSqlite(_connection);
            });

            // Replace IEmailService with a mock for testing
            var emailServiceDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(IEmailService));
            if (emailServiceDescriptor != null)
            {
                services.Remove(emailServiceDescriptor);
            }
            services.AddScoped<IEmailService, MockEmailService>();

        });

        builder.UseSetting("Jwt:Key", JwtKey);
        builder.UseSetting("Jwt:Issuer", JwtIssuer);
        builder.UseSetting("Jwt:Audience", JwtAudience);
        builder.UseSetting("Admin:Email", AdminEmail);
        builder.UseSetting("Admin:Password", AdminPassword);
    }

    /// <summary>
    /// Generates a valid JWT token for the test admin user.
    /// </summary>
    public static string GenerateTestJwt()
    {
        byte[] keyBytes = Encoding.UTF8.GetBytes(JwtKey);
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: new[]
            {
                new Claim(ClaimTypes.Email, AdminEmail),
                new Claim(ClaimTypes.Role, "Admin")
            },
            expires: DateTime.UtcNow.AddDays(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Creates an HttpClient with a valid JWT Authorization header.
    /// </summary>
    public HttpClient CreateAuthenticatedClient()
    {
        HttpClient client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", GenerateTestJwt());
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private class MockEmailService(AppDbContext db) : IEmailService
    {
        private readonly AppDbContext _db = db;
        public async Task<bool> TestConnectionAsync() => await _db.Set<OpenRestoApi.Core.Domain.EmailSettings>().AnyAsync();
        public Task SendEmailAsync(string recipient, string subject, string htmlBody) => Task.CompletedTask;
    }
}
