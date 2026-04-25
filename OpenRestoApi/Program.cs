using OpenRestoApi.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Ensure the app listens on the PORT environment variable for Railway, defaulting to 8080
builder.WebHost.UseUrls($"http://0.0.0.0:{Environment.GetEnvironmentVariable("PORT") ?? "8080"}");

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});

builder.Services.AddProjectDependencies();
builder.Services.AddCustomCors();
builder.Services.AddCustomRateLimiting(builder.Environment);
builder.Services.AddCustomAuthentication(builder.Configuration);

string connectionString = builder.Configuration.GetAppConnectionString(builder.Environment);
builder.Services.AddDatabaseSetup(connectionString, builder.Environment);

WebApplication app = builder.Build();

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.InitializeDatabase(connectionString, builder.Configuration);

app.MapGet("/api/health", () => "OK");

app.Run();
