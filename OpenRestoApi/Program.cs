using OpenRestoApi.Extensions;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Ensure the app listens on the PORT environment variable for Railway, defaulting to 8080
builder.WebHost.UseUrls($"http://0.0.0.0:{Environment.GetEnvironmentVariable("PORT") ?? "8080"}");

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});

builder.Services.AddProblemDetails();
builder.Services.AddProjectDependencies();
builder.Services.AddCustomCors();
builder.Services.AddCustomRateLimiting(builder.Environment);
builder.Services.AddCustomAuthentication(builder.Configuration);

string connectionString = builder.Configuration.GetAppConnectionString(builder.Environment);
builder.Services.AddDatabaseSetup(connectionString, builder.Environment);

WebApplication app = builder.Build();

// Convert unhandled exceptions and bare status-code responses (404/405/etc.)
// into RFC 7807 ProblemDetails JSON. Must be one of the first middlewares so
// it can wrap the rest of the pipeline.
app.UseExceptionHandler();
app.UseStatusCodePages();

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

// Anything under /api/* that isn't matched by a controller route returns a
// JSON ProblemDetails 404 — never the SPA's HTML index or an empty body.
app.MapFallback("/api/{**catchAll}", (HttpContext ctx) =>
    Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Not Found",
        detail: $"The requested API endpoint '{ctx.Request.Path}' does not exist."));

app.InitializeDatabase(connectionString, builder.Configuration);

// Health endpoint: JSON body (consistent with the rest of the API), and opted
// out of rate limiting so liveness probes / scanners never get throttled.
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
    .DisableRateLimiting();

app.Run();
