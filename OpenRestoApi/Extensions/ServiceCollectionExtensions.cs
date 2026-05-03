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
    public static IServiceCollection AddCustomCors(this IServiceCollection services)
    {
        services.AddCors(options =>
        {
            string corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "*";
            string[] origins = corsOrigins.Split(",", StringSplitOptions.RemoveEmptyEntries);

            options.AddPolicy("AllowFrontend",
                builder =>
                {
                    if (corsOrigins == "*")
                    {
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
        string jwtKey = configuration["Jwt:Key"]
            ?? Environment.GetEnvironmentVariable("JWT_KEY")
            ?? "openresto-jwt-signing-key-change-in-production-minimum-32-chars!!";

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
