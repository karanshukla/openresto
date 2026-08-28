using System.Text;
using System.Threading.RateLimiting;
using MailKit.Net.Smtp;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence.Repositories;
using WebPush;
// Microsoft.AspNetCore.Authentication (needed for the API-key AuthenticationSchemeOptions
// registration below) carries its own (deprecated) ISystemClock/SystemClock; alias ours so the
// two don't collide.
using ISystemClock = OpenRestoApi.Core.Application.Interfaces.ISystemClock;
using SystemClock = OpenRestoApi.Core.Application.Interfaces.SystemClock;

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

    /// <summary>Client IP as ASP.NET Core resolved it (after <c>UseForwardedHeaders</c>) — the
    /// partition key for every plain per-IP limiter, including the non-API-key branch of the
    /// global limiter.</summary>
    private static string IpKey(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>Marks a global-limiter bucket as the elevated API-key ceiling rather than the
    /// plain per-IP ceiling — see <see cref="GlobalPartitionKey"/>.</summary>
    internal const string ApiKeyIpPartitionPrefix = "apikey-ip:";

    /// <summary>
    /// The global limiter's partition key for one request. The limiter runs before
    /// authentication, so a key's validity isn't known yet — only whether the header is present.
    /// This used to hash the header value itself, so every distinct (even garbage) header value
    /// minted its own bucket at the elevated <c>apiKeyLimit</c> ceiling: rotating the header
    /// per request bypassed the per-IP global ceiling entirely and left key brute-forcing
    /// effectively unthrottled. Partitioning on the requester's IP instead keeps the elevated
    /// ceiling available to a genuine caller (a headless CLI is one caller, not one browser tab)
    /// without letting it be multiplied by rotating the header value — every request from that IP
    /// bearing the header shares the same one bucket, so the ceiling can't be rotated away.
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_RotatingTheHeaderValueStaysInOneBucketPerIp</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_DifferentIpsWithTheSameHeaderGetDifferentBuckets</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_NoHeaderUsesThePlainIpBucket</seealso>
    /// </summary>
    internal static string GlobalPartitionKey(HttpContext ctx)
    {
        bool hasApiKeyHeader = ctx.Request.Headers.TryGetValue(ApiKeyClaimTypes.HeaderName, out var values)
            && values.Count > 0
            && !string.IsNullOrEmpty(values[0]);
        string ip = IpKey(ctx);
        return hasApiKeyHeader ? $"{ApiKeyIpPartitionPrefix}{ip}" : ip;
    }

    public static IServiceCollection AddCustomRateLimiting(this IServiceCollection services, IWebHostEnvironment env)
    {
        bool isTesting = env.EnvironmentName == "Testing";
        int authLimit = isTesting ? 10000 : 10;   // per IP: brute-force protection on /login
        int publicLimit = isTesting ? 10000 : 120;  // per IP: ~2 req/s, covers normal browsing
        int globalLimit = isTesting ? 10000 : 300;  // per IP: overall ceiling
        int apiKeyLimit = isTesting ? 10000 : 1000; // per key: a headless CLI is one caller, not one browser tab

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
            {
                string partitionKey = GlobalPartitionKey(ctx);
                bool isApiKeyPartition = partitionKey.StartsWith(ApiKeyIpPartitionPrefix, StringComparison.Ordinal);
                return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = isApiKeyPartition ? apiKeyLimit : globalLimit,
                    QueueLimit = 0,
                    Window = TimeSpan.FromMinutes(1),
                });
            });
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

        // A policy scheme in front of JWT Bearer and the API-key handler: every existing
        // [Authorize(Policy = ...)] keeps naming a policy, never a scheme, so accepting a second
        // credential type is zero controller changes. Routing on the presence of the API-key
        // header (rather than trying JWT first and falling back) keeps the two schemes from ever
        // both attempting to parse the same request's credentials.
        services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = "AdminAuth";
                options.DefaultAuthenticateScheme = "AdminAuth";
                options.DefaultChallengeScheme = "AdminAuth";
            })
            .AddPolicyScheme("AdminAuth", "JWT Bearer or API Key", options =>
            {
                options.ForwardDefaultSelector = context =>
                    context.Request.Headers.ContainsKey(ApiKeyClaimTypes.HeaderName)
                        ? ApiKeyClaimTypes.Scheme
                        : JwtBearerDefaults.AuthenticationScheme;
            })
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyClaimTypes.Scheme, _ => { })
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

        // The role → capability mapping lives here and nowhere else; controllers only ever
        // name a policy. LegacyAdmin satisfies both because it is what the pre-multi-user
        // build minted for the one and only admin, who becomes an Owner on upgrade — honouring
        // it keeps in-flight 30-day sessions working instead of silently signing everyone out.
        services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthPolicies.RequireAdmin, policy =>
                policy.RequireRole(UserRoles.Owner, UserRoles.Manager, UserRoles.LegacyAdmin));
            options.AddPolicy(AuthPolicies.RequireOwner, policy =>
                policy.RequireRole(UserRoles.Owner, UserRoles.LegacyAdmin));
        });

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
        // Backs ICurrentUserService — services read the caller off the request's claims
        // rather than being handed an HttpContext.
        services.AddHttpContextAccessor();
        services.AddDistributedMemoryCache();

        // HoldService must be Singleton — the in-memory dictionary must survive across requests
        services.AddSingleton<ISystemClock, SystemClock>();
        services.AddSingleton<IHoldService, HoldService>();
        services.AddScoped<IHoldPolicyService, HoldPolicyService>();
        services.AddScoped<TableAutoAssigner>();

        services.AddScoped<IBookingRepository, BookingRepository>();
        services.AddScoped<IBookingFilterRepository, BookingFilterRepository>();
        services.AddScoped<ITableRepository, TableRepository>();
        services.AddScoped<ISectionRepository, SectionRepository>();
        services.AddScoped<IRestaurantRepository, RestaurantRepository>();
        services.AddScoped<ITableGroupRepository, TableGroupRepository>();
        services.AddScoped<IAdminNotificationRepository, AdminNotificationRepository>();
        services.AddScoped<IAdminPushSubscriptionRepository, AdminPushSubscriptionRepository>();
        services.AddScoped<IAdminCredentialRepository, AdminCredentialRepository>();
        services.AddScoped<IBrandSettingsRepository, BrandSettingsRepository>();
        services.AddScoped<IEmailSettingsRepository, EmailSettingsRepository>();
        services.AddScoped<IEmailFailureRepository, EmailFailureRepository>();
        services.AddScoped<IHighlightRepository, HighlightRepository>();
        services.AddScoped<ISocialLinkRepository, SocialLinkRepository>();
        services.AddScoped<IAdminAuditRepository, AdminAuditRepository>();
        services.AddScoped<IAdminApiKeyRepository, AdminApiKeyRepository>();

        // One instance per request, reachable both as the write-only contract services enrich
        // through and as the concrete draft the audit middleware reads back.
        services.AddScoped<AuditScope>();
        services.AddScoped<IAuditScope>(sp => sp.GetRequiredService<AuditScope>());
        services.AddScoped<AuditQueryService>();
        services.AddScoped<AuditRetentionService>();
        services.AddOptions<OpenRestoApi.Core.Application.Settings.AuditSettings>()
                .BindConfiguration("Audit");
        services.AddHostedService<OpenRestoApi.Infrastructure.Auditing.AuditRetentionWorker>();

        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ISecurityQuestionsService, SecurityQuestionsService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<UserService>();
        services.AddScoped<ApiKeyService>();
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
