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
                // AllowAnyOrigin is incompatible with AllowCredentials,
                // so use SetIsOriginAllowed to permit all origins with credentials
                builder.SetIsOriginAllowed(_ => true)
                       .AllowAnyMethod()
                       .AllowAnyHeader()
                       .AllowCredentials();
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "openresto-api",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "openresto-admin",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
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

// Email
builder.Services.AddDataProtection();
builder.Services.AddSingleton<OpenRestoApi.Infrastructure.Email.CredentialProtector>();
builder.Services.AddSingleton<OpenRestoApi.Infrastructure.Cookies.RecentBookingsCookie>();
builder.Services.AddScoped<IEmailService, OpenRestoApi.Infrastructure.Email.EmailService>();

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

    // ── Schema evolution helpers ──────────────────────────────────────────────
    // Check if a column exists before trying to add it (avoids noisy fail: logs)
    bool ColumnExists(string table, string column)
    {
        using var cmd = db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'";
        db.Database.OpenConnection();
        var result = Convert.ToInt32(cmd.ExecuteScalar(), System.Globalization.CultureInfo.InvariantCulture);
        return result > 0;
    }

    void AddColumnIfMissing(string table, string column, string definition)
    {
        if (!ColumnExists(table, column))
        {
            // Values are hardcoded constants, not user input — safe from injection
#pragma warning disable EF1002
            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition}");
#pragma warning restore EF1002
        }
    }

    // Bookings columns
    AddColumnIfMissing("Bookings", "BookingRef", "TEXT NOT NULL DEFAULT ''");
    AddColumnIfMissing("Bookings", "SpecialRequests", "TEXT");
    AddColumnIfMissing("Bookings", "EndTime", "TEXT");
    AddColumnIfMissing("Bookings", "IsCancelled", "INTEGER NOT NULL DEFAULT 0");
    AddColumnIfMissing("Bookings", "CancelledAt", "TEXT");

    // Restaurants columns
    AddColumnIfMissing("Restaurants", "OpenTime", "TEXT NOT NULL DEFAULT '09:00'");
    AddColumnIfMissing("Restaurants", "CloseTime", "TEXT NOT NULL DEFAULT '22:00'");

    // Tables (CREATE IF NOT EXISTS is safe — no fail: log)
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""EmailSettings"" (
            ""Id"" INTEGER PRIMARY KEY AUTOINCREMENT,
            ""Host"" TEXT NOT NULL DEFAULT '',
            ""Port"" INTEGER NOT NULL DEFAULT 587,
            ""Username"" TEXT NOT NULL DEFAULT '',
            ""EncryptedPassword"" TEXT NOT NULL DEFAULT '',
            ""EnableSsl"" INTEGER NOT NULL DEFAULT 1,
            ""FromName"" TEXT,
            ""FromEmail"" TEXT
        )");

    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""BrandSettings"" (
            ""Id"" INTEGER PRIMARY KEY AUTOINCREMENT,
            ""AppName"" TEXT NOT NULL DEFAULT 'Open Resto',
            ""PrimaryColor"" TEXT NOT NULL DEFAULT '#0a7ea4',
            ""AccentColor"" TEXT,
            ""LogoBase64"" TEXT
        )");

    // Seed initial data when database is empty
    DbSeeder.Seed(db);

    // Seed admin credentials from config if none exist yet
    if (!db.AdminCredentials.Any())
    {
        var email = builder.Configuration["Admin:Email"] ?? "example@example.com";
        var password = builder.Configuration["Admin:Password"] ?? "password";
        var saltBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var salt = Convert.ToBase64String(saltBytes);
        var hashBytes = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            password, saltBytes, 100_000,
            System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        var hash = Convert.ToBase64String(hashBytes);
        db.AdminCredentials.Add(new OpenRestoApi.Core.Domain.AdminCredential
        {
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
        });
        db.SaveChanges();
    }
}

app.Run();

public partial class Program { }
