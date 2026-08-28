using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
// The backend's entry point is a top-level-statements Program.cs, whose compiler-generated class
// lands in the global namespace regardless of the project's RootNamespace — same reason
// TestWebAppFactory references it unqualified as `Program`.
using BackendEntryPoint = Program;

namespace OpenRestoApi.OpenApiExport;

/// <summary>
/// Emits the backend's OpenAPI document to disk (issue #319 Part 1) — the source
/// <c>openresto-cli</c>'s generated transport types are compiled from, and the file
/// <c>ci.yml</c>'s <c>openapi-drift</c> job re-generates and diffs.
/// <para>
/// <c>Microsoft.Extensions.ApiDescription.Server</c>'s build-time generation (the first thing
/// tried here) turned out to fight the app's own startup: it invokes <c>Program</c> through
/// reflection with no <c>ASPNETCORE_ENVIRONMENT</c> set, so <c>AddCustomCors</c>/<c>AddCustomAuthentication</c>'s
/// config guards throw before any document can be produced; forcing <c>Development</c> gets past
/// that but then <c>app.InitializeDatabase()</c> — unconditional in <c>Program.cs</c>, between
/// <c>Build()</c> and <c>Run()</c> — runs a real EF Core migration against the on-disk dev SQLite
/// file as a side effect of running <c>dotnet build</c>, and the emitted filename
/// (<c>{ProjectName}.json</c>) isn't easily pinned to <c>v1.json</c>. This tool instead boots the
/// real app in-process the same way the integration test suite does (<c>TestWebAppFactory</c>):
/// <c>WebApplicationFactory&lt;Program&gt;</c> under <c>ASPNETCORE_ENVIRONMENT=Testing</c>, an
/// in-memory SQLite connection standing in for the real database, and no-op stand-ins for email
/// and the notification queue — then requests the document over the in-process test server exactly
/// as a browser would from <c>MapOpenApi()</c>, and writes the response body to disk.
/// </para>
/// </summary>
internal static class Program
{
    private const string DefaultRelativeOutputPath = "../../openresto-cli/openapi/v1.json";

    private static async Task<int> Main(string[] args)
    {
        string outputPath = ResolveOutputPath(args);

        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();

        await using var factory = new WebApplicationFactory<BackendEntryPoint>()
            .WithWebHostBuilder(builder => Configure(builder, connection));

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/openapi/v1.json");
        if (!response.IsSuccessStatusCode)
        {
            await Console.Error.WriteLineAsync(
                $"Failed to fetch the OpenAPI document: {(int)response.StatusCode} {response.StatusCode}");
            return 1;
        }

        string json = await response.Content.ReadAsStringAsync();
        string formatted = ReformatStably(json);

        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
        await File.WriteAllTextAsync(outputPath, formatted);

        Console.WriteLine($"Wrote OpenAPI document to {Path.GetFullPath(outputPath)}");
        return 0;
    }

    private static string ResolveOutputPath(string[] args)
        => args.Length > 0 ? args[0] : DefaultRelativeOutputPath;

    /// <summary>Re-serializes with stable, indented formatting and a trailing newline so the
    /// committed file diffs cleanly run to run rather than churning on whitespace.</summary>
    private static string ReformatStably(string json)
    {
        using System.Text.Json.JsonDocument doc = System.Text.Json.JsonDocument.Parse(json);
        var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        return System.Text.Json.JsonSerializer.Serialize(doc.RootElement, options) + Environment.NewLine;
    }

    private static void Configure(IWebHostBuilder builder, SqliteConnection connection)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            List<ServiceDescriptor> dbDescriptors = [.. services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                || d.ServiceType == typeof(DbContextOptions)
                || d.ServiceType == typeof(AppDbContext))];
            foreach (ServiceDescriptor descriptor in dbDescriptors)
            {
                services.Remove(descriptor);
            }
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));

            Replace<IEmailService>(services, new NoOpEmailService());
            Replace<INotificationQueue>(services, new NoOpNotificationQueue());
        });

        builder.UseSetting("Jwt:Key", "openapi-export-tool-signing-key-not-a-real-secret-32ch");
        builder.UseSetting("Cors:Origins", "http://localhost");
        builder.UseSetting("Admin:Email", "openapi-export@openresto.local");
        builder.UseSetting("Admin:Password", "openapi-export-tool-bootstrap-password");
    }

    private static void Replace<TService>(IServiceCollection services, TService instance)
        where TService : class
    {
        ServiceDescriptor? existing = services.FirstOrDefault(d => d.ServiceType == typeof(TService));
        if (existing is not null)
        {
            services.Remove(existing);
        }
        services.AddSingleton(instance);
    }

    private sealed class NoOpEmailService : IEmailService
    {
        public Task<bool> TestConnectionAsync() => Task.FromResult(true);
        public Task SendEmailAsync(string recipient, string subject, string htmlBody) => Task.CompletedTask;
    }

    private sealed class NoOpNotificationQueue : INotificationQueue
    {
        public void EnqueueBookingCreated(Booking booking, string restaurantName) { }
        public void EnqueueBookingCancelled(Booking booking, string restaurantName) { }
        public void EnqueueCapacityCheck(int restaurantId, string restaurantName, DateTime bookingDate) { }
    }
}
