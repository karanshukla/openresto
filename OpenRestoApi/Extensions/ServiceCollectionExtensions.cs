using System.Text;
using System.Threading.RateLimiting;
using MailKit.Net.Smtp;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using WebPush;

namespace OpenRestoApi.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCustomCors(this IServiceCollection services, IConfiguration configuration)
    {
        string? configCorsOrigins = configuration["Cors:Origins"];
        string? corsOrigins = string.IsNullOrWhiteSpace(configCorsOrigins)
            ? Environment.GetEnvironmentVariable("CORS_ORIGINS")
            : configCorsOrigins;

        if (string.IsNullOrWhiteSpace(corsOrigins) || corsOrigins.Trim() == "*")
        {
            throw new InvalidOperationException(
                "Cors:Origins must be explicitly configured with allowed origins (comma-separated). " +
                "Wildcards are not permitted. Set via Cors:Origins config or CORS_ORIGINS env var.");
        }

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
        int authLimit = isTesting ? 10000 : 10;   // per IP: brute-force protection on /login
        int publicLimit = isTesting ? 10000 : 120;  // per IP: ~2 req/s, covers normal browsing
        int globalLimit = isTesting ? 10000 : 300;  // per IP: overall ceiling

        static string IpKey(HttpContext ctx) =>
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy("auth", ctx =>
                RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = authLimit,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            options.AddPolicy("public", ctx =>
                RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = publicLimit,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = globalLimit,
                    QueueLimit = 0,
                    Window = TimeSpan.FromMinutes(1),
                }));
        });

        return services;
    }

    public static IServiceCollection AddCustomAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        string? configJwtKey = configuration["Jwt:Key"];
        string? jwtKey = string.IsNullOrWhiteSpace(configJwtKey)
            ? Environment.GetEnvironmentVariable("JWT_KEY")
            : configJwtKey;

        if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
        {
            throw new InvalidOperationException(
                "Jwt:Key must be set (via config or JWT_KEY env var) and be at least 32 characters. " +
                "Generate one with: openssl rand -base64 48");
        }

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
        services.AddScoped<IHoldPolicyService, HoldPolicyService>();

        services.AddScoped<IBookingRepository, BookingRepository>();
        services.AddScoped<IBookingFilterRepository, BookingFilterRepository>();
        services.AddScoped<ITableRepository, TableRepository>();
        services.AddScoped<ISectionRepository, SectionRepository>();
        services.AddScoped<IRestaurantRepository, RestaurantRepository>();
        services.AddScoped<IAdminNotificationRepository, AdminNotificationRepository>();
        services.AddScoped<IAdminPushSubscriptionRepository, AdminPushSubscriptionRepository>();
        services.AddScoped<IAdminCredentialRepository, AdminCredentialRepository>();
        services.AddScoped<IBrandSettingsRepository, BrandSettingsRepository>();
        services.AddScoped<IEmailSettingsRepository, EmailSettingsRepository>();
        services.AddScoped<IEmailFailureRepository, EmailFailureRepository>();
        services.AddScoped<IHighlightRepository, HighlightRepository>();
        services.AddScoped<ISocialLinkRepository, SocialLinkRepository>();

        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ISecurityQuestionsService, SecurityQuestionsService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<BookingService>();
        services.AddScoped<AdminService>();
        services.AddScoped<RestaurantManagementService>();
        services.AddScoped<BrandService>();
        services.AddScoped<EmailSettingsService>();
        services.AddScoped<HighlightService>();
        services.AddScoped<SocialLinkService>();
        services.AddScoped<IAvailabilityService, AvailabilityService>();
        services.AddScoped<MediaService>();

        services.AddSingleton<OpenRestoApi.Core.Application.Mappings.BookingMapper>();

        var dpKeysPath = Environment.GetEnvironmentVariable("DATA_PROTECTION_KEYS_PATH");
        var dpBuilder = services.AddDataProtection().SetApplicationName("openresto");
        if (!string.IsNullOrEmpty(dpKeysPath))
            dpBuilder.PersistKeysToFileSystem(new DirectoryInfo(dpKeysPath));
        services.AddSingleton<OpenRestoApi.Infrastructure.Email.CredentialProtector>();
        services.AddSingleton<OpenRestoApi.Infrastructure.Cookies.RecentBookingsCookie>();
        services.AddSingleton<IAuthCookieService, AuthCookieService>();
        services.AddScoped<Func<ISmtpClient>>(_ => () => new SmtpClient());
        services.AddScoped<IEmailService, OpenRestoApi.Infrastructure.Email.EmailService>();
        services.AddScoped<IEmailTemplateService, OpenRestoApi.Core.Application.Services.EmailTemplateService>();
        services.AddScoped<IBookingConfirmationService, OpenRestoApi.Core.Application.Services.BookingConfirmationService>();
        services.AddScoped<INotificationService, OpenRestoApi.Core.Application.Services.NotificationService>();
        services.AddScoped<IWebPushClient, WebPushClient>();
        services.AddScoped<IBookingNotificationService, OpenRestoApi.Core.Application.Services.BookingNotificationService>();
        services.AddOptions<OpenRestoApi.Core.Application.Settings.VapidSettings>()
                .BindConfiguration("Vapid");

        services.AddSingleton<OpenRestoApi.Infrastructure.Notifications.NotificationQueue>();
        services.AddSingleton<INotificationQueue>(sp =>
            sp.GetRequiredService<OpenRestoApi.Infrastructure.Notifications.NotificationQueue>());
        services.AddHostedService<OpenRestoApi.Infrastructure.Notifications.NotificationWorker>();

        services.AddSession(options =>
        {
            options.IdleTimeout = TimeSpan.FromSeconds(10);
            options.Cookie.HttpOnly = true;
            options.Cookie.IsEssential = true;
        });

        return services;
    }
}
