using System.Text;
using System.Threading.RateLimiting;
using CustomAccessibility.Attributes;
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
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal const string ApiKeyIpPartitionPrefix = "apikey-ip:";

    /// <summary>
    /// The global limiter's partition key for one request. The limiter runs before
    /// authentication, so a key's validity isn't known yet — only its shape.
    /// This used to hash the header value itself, so every distinct (even garbage) header value
    /// minted its own bucket at the elevated <c>apiKeyLimit</c> ceiling: rotating the header
    /// per request bypassed the per-IP global ceiling entirely and left key brute-forcing
    /// effectively unthrottled. Partitioning on the requester's IP instead keeps the elevated
    /// ceiling available to a genuine caller (a headless CLI is one caller, not one browser tab)
    /// without letting it be multiplied by rotating the header value — every request from that IP
    /// bearing the header shares the same one bucket, so the ceiling can't be rotated away.
    /// <para>
    /// Presence alone is still not enough to earn that bucket: <c>X-API-Key: x</c> would lift any
    /// anonymous client's own ceiling from <c>globalLimit</c> to <c>apiKeyLimit</c> for the cost
    /// of one header. <see cref="ApiKeyCrypto.TryParseId"/> is the cheapest check that survives
    /// running pre-auth — it reads the <c>orst_&lt;id&gt;_&lt;secret&gt;</c> shape without touching
    /// the secret or the database — so a header that isn't shaped like a key this scheme could
    /// have issued falls back to the plain per-IP bucket. A well-formed but unissued value still
    /// reaches the elevated bucket; that is the ceiling the per-IP partition already bounds.
    /// </para>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_RotatingTheHeaderValueStaysInOneBucketPerIp</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_DifferentIpsWithTheSameHeaderGetDifferentBuckets</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_NoHeaderUsesThePlainIpBucket</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_AMalformedHeaderUsesThePlainIpBucket</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.GlobalPartitionKey_AWellFormedKeyUsesTheElevatedBucket</seealso>
    /// </summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal static string GlobalPartitionKey(HttpContext ctx)
    {
        bool hasApiKeyShapedHeader = ctx.Request.Headers.TryGetValue(ApiKeyClaimTypes.HeaderName, out var values)
            && values.Count > 0
            && ApiKeyCrypto.TryParseId(values[0], out _);
        string ip = IpKey(ctx);
        return hasApiKeyShapedHeader ? $"{ApiKeyIpPartitionPrefix}{ip}" : ip;
    }

    /// <summary>Rate-limit policy name for the guest by-reference booking endpoints — see
    /// <see cref="BookingLookupLimit"/>.</summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Integration.BookingRefEndpointRateLimitTests")]
    [ExternalAccessAllowed]
    internal const string BookingLookupPolicy = "booking-lookup";

    /// <summary>
    /// Per-IP ceiling, requests per one-minute window, on the two guest endpoints that take a
    /// booking reference (<c>GET</c> and <c>POST .../cancel</c> under <c>bookings/ref</c>). Those
    /// are the only unauthenticated endpoints where a correct guess hands over someone else's
    /// name, phone, party and cancel button, which is the same reason <c>authLimit</c> exists on
    /// login — so it is set to the same figure rather than to browsing's far looser
    /// <c>publicLimit</c>. A guest reads their reference off an email and looks it up once, maybe
    /// twice after a typo; ten a minute leaves that untouched.
    /// <para>
    /// This is defence in depth, never the defence: see
    /// <see cref="Core.Domain.BookingRefGenerator"/> for why a per-IP limit cannot on its own
    /// protect a reference an attacker can guess from a pool of addresses, and why the
    /// reference's width is the part that has to carry it.
    /// </para>
    /// <seealso>ServiceCollectionExtensionsTests.BookingLookupLimit_IsAsTightAsTheLoginLimit</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.BookingLookupLimit_IsFarTighterThanPublicBrowsing</seealso>
    /// <seealso>ServiceCollectionExtensionsTests.BookingLookupLimit_KeepsTheTestingEscapeHatch</seealso>
    /// </summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal const int BookingLookupLimit = 10;

    /// <summary>Ceiling every policy is raised to under <c>ASPNETCORE_ENVIRONMENT=Testing</c>, so
    /// the Playwright suite can drive hundreds of requests from one address.</summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal const int TestingLimit = 10000;

    /// <summary>Per-IP ceiling on login and the other credential surfaces — brute-force
    /// protection.</summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal const int AuthLimit = 10;

    /// <summary>Per-IP ceiling on ordinary browsing: ~2 req/s.</summary>
    [OnlyAccessibleBy("OpenRestoApi.Extensions.*")]
    [OnlyAccessibleBy("OpenRestoApi.Tests.Extensions.ServiceCollectionExtensionsTests")]
    [ExternalAccessAllowed]
    internal const int PublicLimit = 120;

    public static IServiceCollection AddCustomRateLimiting(this IServiceCollection services, IWebHostEnvironment env)
    {
        bool isTesting = env.EnvironmentName == "Testing";
        int authLimit = isTesting ? TestingLimit : AuthLimit;
        int publicLimit = isTesting ? TestingLimit : PublicLimit;
        int bookingLookupLimit = isTesting ? TestingLimit : BookingLookupLimit;
        int globalLimit = isTesting ? TestingLimit : 300;  // per IP: overall ceiling
        int apiKeyLimit = isTesting ? TestingLimit : 1000; // per key: a headless CLI is one caller, not one browser tab

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

            options.AddPolicy(BookingLookupPolicy, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(IpKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    AutoReplenishment = true,
                    PermitLimit = bookingLookupLimit,
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

    /// <summary>How long the native-app readiness checks wait on one <c>/.well-known/</c> fetch
    /// before reporting it unreachable — the admin screen blocks on them, so this is short.</summary>
    private static readonly TimeSpan WellKnownProbeTimeout = TimeSpan.FromSeconds(5);

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
        services.AddScoped<INativeClientStatsRepository, NativeClientStatsRepository>();

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
        services.AddScoped<EmailPreviewService>();
        services.AddScoped<HighlightService>();
        services.AddScoped<SocialLinkService>();
        services.AddScoped<IAvailabilityService, AvailabilityService>();
        services.AddScoped<MediaService>();
        services.AddScoped<NativeAppStatusService>();

        // Native guest-app telemetry: an in-memory counter on the request path, flushed to the
        // database by a background worker, so no request ever writes to SQLite for a header.
        services.AddSingleton<INativeClientStatsCollector,
            OpenRestoApi.Infrastructure.NativeClients.NativeClientStatsCollector>();
        services.AddHostedService<OpenRestoApi.Infrastructure.NativeClients.NativeClientStatsWorker>();

        // Only ever fetches this deployment's own configured public address — see WellKnownProbe.
        // No redirects: neither store's verifier follows one, and a redirect is also how a public
        // host would hand the probe an internal address after the host check has passed.
        services.AddHttpClient(OpenRestoApi.Infrastructure.NativeClients.WellKnownProbe.HttpClientName,
            client =>
            {
                client.Timeout = WellKnownProbeTimeout;
                client.MaxResponseContentBufferSize = OpenRestoApi.Infrastructure.NativeClients.WellKnownProbe.MaxBodyBytes;
            })
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });
        services.AddScoped<IWellKnownProbe, OpenRestoApi.Infrastructure.NativeClients.WellKnownProbe>();

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

        // Guest booking reminders: browsers ride the VAPID client above, the native app goes
        // through Expo's push service, and one worker decides what is due each minute.
        services.AddOptions<OpenRestoApi.Core.Application.Settings.GuestPushSettings>()
                .BindConfiguration("GuestPush");
        services.AddScoped<IGuestPushSubscriptionRepository,
            OpenRestoApi.Infrastructure.Persistence.Repositories.GuestPushSubscriptionRepository>();
        services.AddHttpClient(OpenRestoApi.Infrastructure.Notifications.ExpoPushClient.HttpClientName,
            client => client.Timeout = TimeSpan.FromSeconds(15));
        services.AddScoped<IExpoPushClient, OpenRestoApi.Infrastructure.Notifications.ExpoPushClient>();
        services.AddScoped<IGuestPushSender, OpenRestoApi.Core.Application.Services.GuestPushSender>();
        services.AddScoped<OpenRestoApi.Core.Application.Services.GuestReminderService>();
        services.AddHostedService<OpenRestoApi.Infrastructure.Notifications.GuestReminderWorker>();

        // Wallet passes: the signing material is read from disk once per process.
        services.AddOptions<OpenRestoApi.Core.Application.Settings.WalletSettings>()
                .BindConfiguration("Wallet");
        services.AddSingleton<IWalletCredentials, OpenRestoApi.Infrastructure.Wallet.WalletCredentialStore>();
        services.AddScoped<OpenRestoApi.Core.Application.Services.WalletPassService>();

        services.AddSession(options =>
        {
            options.IdleTimeout = TimeSpan.FromSeconds(10);
            options.Cookie.HttpOnly = true;
            options.Cookie.IsEssential = true;
        });

        return services;
    }
}
