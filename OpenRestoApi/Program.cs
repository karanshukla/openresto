using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "*";
    var origins = corsOrigins.Split(",", StringSplitOptions.RemoveEmptyEntries);

    options.AddPolicy("AllowFrontend",
        builder =>
        {
            if (corsOrigins == "*")
            {
                builder.AllowAnyOrigin()
                       .AllowAnyMethod()
                       .AllowAnyHeader();
            }
            else
            {
                builder.WithOrigins(origins)
                       .AllowAnyMethod()
                       .AllowAnyHeader()
                       .AllowCredentials();
            }
        });
});

builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.Identity?.Name ?? httpContext.Request.Headers.Host.ToString(),
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 10,
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// ── JWT Authentication ──────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? Environment.GetEnvironmentVariable("JWT_KEY")
    ?? "openresto-jwt-signing-key-change-in-production-minimum-32-chars!!";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer           = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"] ?? "openresto-api",
            ValidateAudience         = true,
            ValidAudience            = builder.Configuration["Jwt:Audience"] ?? "openresto-admin",
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddDistributedMemoryCache();

// HoldService must be Singleton — the in-memory dictionary must survive across requests
builder.Services.AddSingleton<ISystemClock, SystemClock>();
builder.Services.AddSingleton<IHoldService, HoldService>();

builder.Services.AddScoped<IBookingRepository, BookingRepository>();
builder.Services.AddScoped<ITableRepository, TableRepository>();
builder.Services.AddScoped<ISectionRepository, SectionRepository>();
builder.Services.AddScoped<IRestaurantRepository, RestaurantRepository>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddSingleton<OpenRestoApi.Core.Application.Mappings.BookingMapper>();

// Database (SQLite)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("CONNECTION_STRING")
    ?? "Data Source=./openresto.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromSeconds(10);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Ensure DB is created for first run
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Schema evolution: create AdminCredentials table if it doesn't exist yet
    // (handles existing databases created before this table was added)
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "AdminCredentials" (
            "Id"               INTEGER NOT NULL CONSTRAINT "PK_AdminCredentials" PRIMARY KEY AUTOINCREMENT,
            "Email"            TEXT    NOT NULL,
            "PasswordHash"     TEXT    NOT NULL,
            "PasswordSalt"     TEXT    NOT NULL,
            "PvqQuestion"      TEXT,
            "PvqAnswerHash"    TEXT,
            "PvqAnswerSalt"    TEXT,
            "ResetToken"       TEXT,
            "ResetTokenExpiry" TEXT
        )
        """);

    // Schema evolution: add new columns if they don't exist yet
    try { db.Database.ExecuteSqlRaw("ALTER TABLE \"Bookings\" ADD COLUMN \"BookingRef\" TEXT NOT NULL DEFAULT ''"); }
    catch { /* column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE \"Bookings\" ADD COLUMN \"SpecialRequests\" TEXT"); }
    catch { /* column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE \"Bookings\" ADD COLUMN \"EndTime\" TEXT"); }
    catch { /* column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE \"Restaurants\" ADD COLUMN \"OpenTime\" TEXT NOT NULL DEFAULT '09:00'"); }
    catch { /* column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE \"Restaurants\" ADD COLUMN \"CloseTime\" TEXT NOT NULL DEFAULT '22:00'"); }
    catch { /* column already exists */ }

    // Seed initial data when database is empty
    DbSeeder.Seed(db);

    // Seed admin credentials from config if none exist yet
    if (!db.AdminCredentials.Any())
    {
        var email    = builder.Configuration["Admin:Email"]    ?? "example@example.com";
        var password = builder.Configuration["Admin:Password"] ?? "password";
        var saltBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var salt      = Convert.ToBase64String(saltBytes);
        var hashBytes = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            password, saltBytes, 100_000,
            System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        var hash = Convert.ToBase64String(hashBytes);
        db.AdminCredentials.Add(new OpenRestoApi.Core.Domain.AdminCredential
        {
            Email        = email,
            PasswordHash = hash,
            PasswordSalt = salt,
        });
        db.SaveChanges();
    }
}

app.Run();
