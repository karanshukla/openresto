using System.Text;
using System.Threading.RateLimiting;
using MailKit.Net.Smtp;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCustomCors(this IServiceCollection services, IConfiguration configuration)
    {
        string? corsOrigins = configuration["Cors:Origins"]
            ?? Environment.GetEnvironmentVariable("CORS_ORIGINS");

        if (string.IsNullOrWhiteSpace(corsOrigins) || corsOrigins.Trim() == "*")
            throw new InvalidOperationException(
                "Cors:Origins must be explicitly configured with allowed origins (comma-separated). " +
                "Wildcards are not permitted. Set via Cors:Origins config or CORS_ORIGINS env var.");

        string[] origins = corsOrigins.Split(",", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend",
                builder =>
                {
                    builder.WithOrigins(origins)
                           .AllowAnyMethod()
                           .AllowAnyHeader()
                           .AllowCredentials();
                });
        });

        return services;
    }

    public static IServiceCollection AddCustomRateLimiting(this IServiceCollection services, IWebHostEnvironment env)
    {
        bool isTesting = env.EnvironmentName == "Testing";
        int authLimit = isTesting ? 10000 : 5;
        int publicLimit = isTesting ? 10000 : 30;
        int globalLimit = isTesting ? 10000 : 60;

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddFixedWindowLimiter("auth", limiter =>
            {
                limiter.PermitLimit = authLimit;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });

            options.AddFixedWindowLimiter("public", limiter =>
            {
                limiter.PermitLimit = publicLimit;
                limiter.Window = TimeSpan.FromMinutes(1);
                limiter.QueueLimit = 0;
            });

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        AutoReplenishment = true,
                        PermitLimit = globalLimit,
                        QueueLimit = 0,
                        Window = TimeSpan.FromMinutes(1)
                    }));
        });

        return services;
    }

    public static IServiceCollection AddCustomAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        string? jwtKey = configuration["Jwt:Key"]
            ?? Environment.GetEnvironmentVariable("JWT_KEY");

        if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
            throw new InvalidOperationException(
                "Jwt:Key must be set (via config or JWT_KEY env var) and be at least 32 characters. " +
                "Generate one with: openssl rand -base64 48");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = true,
                    ValidIssuer = configuration["Jwt:Issuer"] ?? "openresto-api",
                    ValidateAudience = true,
                    ValidAudience = configuration["Jwt:Audience"] ?? "openresto-admin",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                };

                // Read JWT from HttpOnly cookie if no Authorization header is present
                options.Events = new JwtBearerEvents
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

        services.AddAuthorization();

        return services;
    }

    public static IServiceCollection AddProjectDependencies(this IServiceCollection services)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1; // only process the immediate upstream hop; prevents X-Forwarded-For spoofing
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        services.AddControllers();
        services.AddOpenApi();
        services.AddDistributedMemoryCache();

        // HoldService must be Singleton — the in-memory dictionary must survive across requests
        services.AddSingleton<ISystemClock, SystemClock>();
        services.AddSingleton<IHoldService, HoldService>();

        services.AddScoped<IBookingRepository, BookingRepository>();
        services.AddScoped<ITableRepository, TableRepository>();
        services.AddScoped<ISectionRepository, SectionRepository>();
        services.AddScoped<IRestaurantRepository, RestaurantRepository>();

        services.AddScoped<BookingService>();
        services.AddScoped<AdminService>();
        services.AddScoped<RestaurantManagementService>();
        services.AddScoped<BrandService>();
        services.AddScoped<EmailSettingsService>();
        services.AddScoped<AvailabilityService>();

        services.AddSingleton<OpenRestoApi.Core.Application.Mappings.BookingMapper>();

        services.AddDataProtection();
        services.AddSingleton<OpenRestoApi.Infrastructure.Email.CredentialProtector>();
        services.AddSingleton<OpenRestoApi.Infrastructure.Cookies.RecentBookingsCookie>();
        services.AddScoped<Func<ISmtpClient>>(_ => () => new SmtpClient());
        services.AddScoped<IEmailService, OpenRestoApi.Infrastructure.Email.EmailService>();

        services.AddSession(options =>
        {
            options.IdleTimeout = TimeSpan.FromSeconds(10);
            options.Cookie.HttpOnly = true;
            options.Cookie.IsEssential = true;
        });

        return services;
    }
}
