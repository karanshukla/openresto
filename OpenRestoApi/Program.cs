using System.Data.Common;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    string corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "*";
    string[] origins = corsOrigins.Split(",", StringSplitOptions.RemoveEmptyEntries);

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
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Strict limit for auth endpoints (login, PVQ) — 5 per minute per IP
    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });

    // General public endpoint limit — 30 per minute per IP
    options.AddFixedWindowLimiter("public", limiter =>
    {
        limiter.PermitLimit = 30;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });

    // Global fallback — 60 per minute per IP (for admin authenticated calls)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 60,
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            }));
});

// ── JWT Authentication ──────────────────────────────────────────────────────
string jwtKey = builder.Configuration["Jwt:Key"]
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

        // Read JWT from HttpOnly cookie if no Authorization header is present
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (string.IsNullOrEmpty(context.Token) && context.Request.Cookies.TryGetValue("openresto_auth", out string? cookie))
                {
                    context.Token = cookie;
                }
                return Task.CompletedTask;
            }
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
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<RestaurantManagementService>();
builder.Services.AddScoped<BrandService>();
builder.Services.AddScoped<EmailSettingsService>();
builder.Services.AddSingleton<OpenRestoApi.Core.Application.Mappings.BookingMapper>();

// Email
builder.Services.AddDataProtection();
builder.Services.AddSingleton<OpenRestoApi.Infrastructure.Email.CredentialProtector>();
builder.Services.AddSingleton<OpenRestoApi.Infrastructure.Cookies.RecentBookingsCookie>();
builder.Services.AddScoped<IEmailService, OpenRestoApi.Infrastructure.Email.EmailService>();

// Database (SQLite)
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
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


WebApplication app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

// ── Security headers ────────────────────────────────────────────────────────
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    await next();
});

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Ensure DB is created for first run
using (IServiceScope scope = app.Services.CreateScope())
{
    AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
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
        using DbCommand cmd = db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'";
        db.Database.OpenConnection();
        int result = Convert.ToInt32(cmd.ExecuteScalar(), System.Globalization.CultureInfo.InvariantCulture);
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
    AddColumnIfMissing("Restaurants", "OpenDays", "TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7'");

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
        string email = builder.Configuration["Admin:Email"] ?? "example@example.com";
        string password = builder.Configuration["Admin:Password"] ?? "password";
        byte[] saltBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        string salt = Convert.ToBase64String(saltBytes);
        byte[] hashBytes = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            password, saltBytes, 100_000,
            System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        string hash = Convert.ToBase64String(hashBytes);
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
