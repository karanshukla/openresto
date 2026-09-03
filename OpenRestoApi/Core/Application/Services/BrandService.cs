using System.Text.RegularExpressions;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class BrandService(
    IBrandSettingsRepository brandRepository,
    IConfiguration configuration,
    IAuditScope? audit = null)
{
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IConfiguration _configuration = configuration;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    private const string DefaultCliPackageUrl = "https://www.npmjs.com/package/openresto-cli";
    private const string DefaultApiDocsUrl =
        "https://github.com/karanshukla/openresto/blob/main/docs/http-api.md";
    private const string DefaultRepositoryUrl = "https://github.com/karanshukla/openresto";

    /// <summary>
    /// What <see cref="GetWebsiteUrl"/> falls back to when nothing names a public address. It is
    /// the dev server, so anything deciding whether this deployment is publicly reachable —
    /// <see cref="NativeAppStatusService"/> — compares against this rather than guessing.
    /// </summary>
    public const string DefaultWebsiteUrl = "http://localhost:8081";

    /// <summary>Permitted values for <see cref="BrandSettings.HeaderImageFit"/> (case-insensitive).</summary>
    public static readonly HashSet<string> AllowedHeaderImageFits =
        new(StringComparer.OrdinalIgnoreCase) { "Cover", "Contain" };

    private static bool IsValidHexColor(string color)
    {
        return Regex.IsMatch(color, @"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$");
    }

    public string GetWebsiteUrl(BrandSettings? brand = null)
    {
        if (!string.IsNullOrWhiteSpace(brand?.WebsiteUrl))
            return brand.WebsiteUrl;

        string? explicit_ = _configuration["Website:Url"] ?? Environment.GetEnvironmentVariable("WEBSITE_URL");
        if (!string.IsNullOrWhiteSpace(explicit_))
            return explicit_;

        // Fall back to the first CORS origin — self-hosters already set this to their public domain
        string? corsOrigins = _configuration["Cors:Origins"] ?? Environment.GetEnvironmentVariable("CORS_ORIGINS");
        if (!string.IsNullOrWhiteSpace(corsOrigins))
        {
            string first = corsOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)[0];
            if (!string.IsNullOrWhiteSpace(first))
                return first;
        }

        return DefaultWebsiteUrl;
    }

    public async Task<string> GetWebsiteUrlAsync()
    {
        BrandSettings? brand = await _brandRepository.GetAsync();
        return GetWebsiteUrl(brand);
    }

    /// <summary>
    /// Resolves the default UI locale from <c>Locale:Default</c> configuration, then the
    /// <c>OPENRESTO_DEFAULT_LOCALE</c> environment variable, falling back to
    /// <see cref="SupportedLocales.Default"/> when neither is set or the value isn't supported.
    /// The unused <paramref name="brand"/> parameter mirrors <see cref="GetWebsiteUrl"/>: #376
    /// adds <c>BrandSettings.DefaultLocale</c> as a higher-priority layer, and this signature
    /// means that change touches this method body and no call sites.
    /// </summary>
    public string GetDefaultLocale(BrandSettings? brand = null)
    {
        string? configured = _configuration["Locale:Default"]
            ?? Environment.GetEnvironmentVariable("OPENRESTO_DEFAULT_LOCALE");

        return SupportedLocales.IsSupported(configured)
            ? configured!.Trim().ToLowerInvariant()
            : SupportedLocales.Default;
    }

    /// <summary>
    /// Where the admin's API-keys screen sends someone who wants to call the API themselves:
    /// the published CLI package, the guide to raw HTTP calls, and the source repository.
    /// Each resolves from configuration, then the environment, then the upstream OpenResto URL,
    /// so a fork that ships its own client or docs redirects them without a frontend rebuild —
    /// the same reason <see cref="GetDefaultLocale"/> lives here rather than in an
    /// <c>EXPO_PUBLIC_*</c> build arg.
    /// </summary>
    /// <seealso>BrandServiceTests.GetCliPackageUrl_UsesConfiguredValue</seealso>
    /// <seealso>BrandServiceTests.GetRepositoryUrl_FallsBackToUpstream_WhenUnset</seealso>
    public string GetCliPackageUrl()
        => ResolveLink("Links:CliPackage", "OPENRESTO_CLI_PACKAGE_URL", DefaultCliPackageUrl);

    /// <inheritdoc cref="GetCliPackageUrl"/>
    public string GetApiDocsUrl()
        => ResolveLink("Links:ApiDocs", "OPENRESTO_API_DOCS_URL", DefaultApiDocsUrl);

    /// <inheritdoc cref="GetCliPackageUrl"/>
    public string GetRepositoryUrl()
        => ResolveLink("Links:Repository", "OPENRESTO_REPOSITORY_URL", DefaultRepositoryUrl);

    private string ResolveLink(string configKey, string environmentVariable, string fallback)
    {
        string? configured = _configuration[configKey]
            ?? Environment.GetEnvironmentVariable(environmentVariable);

        return IsWebUrl(configured) ? configured!.Trim() : fallback;
    }

    /// <summary>
    /// 
    /// </summary>
    /// <seealso>BrandServiceTests.GetRepositoryUrl_IgnoresNonWebScheme</seealso>
    private static bool IsWebUrl(string? value)
        => Uri.TryCreate(value?.Trim(), UriKind.Absolute, out Uri? uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    public async Task<BrandSettings> GetAsync()
    {
        return await _brandRepository.GetAsync()
            ?? new BrandSettings
            {
                AppName = "Open Resto",
                PrimaryColor = "#0a7ea4"
            };
    }

    /// <summary>
    /// Applies a partial update: null leaves a field as it was, an empty/blank string clears it,
    /// anything else replaces it. Every rejection throws <c>ValidationException</c> carrying an
    /// <see cref="ErrorCodes"/> code.
    /// <seealso>BrandServiceTests.SaveAsync_Throws_WhenWebsiteUrlIsNotAnAbsoluteWebUrl</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_Throws_WhenPrivacyPolicyUrlIsNotAnAbsoluteWebUrl</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_PersistsPrivacyPolicyUrl</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_ClearsPrivacyPolicyUrl_WhenBlank</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_Throws_WhenMinimumAppVersionIsNotMajorMinorPatch</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_PersistsMinimumAppVersion</seealso>
    /// <seealso>BrandServiceTests.SaveAsync_ClearsMinimumAppVersion_WhenBlank</seealso>
    /// </summary>
    public async Task SaveAsync(
        string? appName,
        string? primaryColor,
        string? accentColor,
        string? faviconIcon = null,
        string? websiteUrl = null,
        string? phoneNumber = null,
        string? emailAddress = null,
        string? copyrightText = null,
        string? subtitle = null,
        string? highlightsHeading = null,
        string? highlightsSubheading = null,
        string? headerImageFit = null,
        string? privacyPolicyUrl = null,
        string? minimumAppVersion = null)
    {
        if (appName != null && appName.Length > 32)
        {
            throw new ValidationException("App name cannot exceed 32 characters.") { Code = ErrorCodes.BrandAppNameTooLong };
        }

        if (primaryColor != null && !IsValidHexColor(primaryColor))
        {
            throw new ValidationException("Invalid primary color hex code.") { Code = ErrorCodes.BrandPrimaryColorInvalid };
        }

        if (accentColor != null && !IsValidHexColor(accentColor))
        {
            throw new ValidationException("Invalid accent color hex code.") { Code = ErrorCodes.BrandAccentColorInvalid };
        }

        // Blank clears the icon (the picker's deselect); a non-blank value must be one we can draw.
        if (faviconIcon != null
            && !string.IsNullOrWhiteSpace(faviconIcon)
            && LucideIconPaths.Get(faviconIcon) == null)
        {
            throw new ValidationException("Invalid favicon icon.") { Code = ErrorCodes.BrandFaviconInvalid };
        }

        if (copyrightText != null && copyrightText.Length > 200)
        {
            throw new ValidationException("Copyright text cannot exceed 200 characters.") { Code = ErrorCodes.BrandCopyrightTooLong };
        }

        if (subtitle != null && subtitle.Length > 160)
        {
            throw new ValidationException("Subtitle cannot exceed 160 characters.") { Code = ErrorCodes.BrandSubtitleTooLong };
        }

        if (highlightsHeading != null && highlightsHeading.Length > 60)
        {
            throw new ValidationException("Highlights heading cannot exceed 60 characters.") { Code = ErrorCodes.BrandHighlightsHeadingTooLong };
        }

        if (highlightsSubheading != null && highlightsSubheading.Length > 60)
        {
            throw new ValidationException("Highlights subheading cannot exceed 60 characters.") { Code = ErrorCodes.BrandHighlightsSubheadingTooLong };
        }

        // Empty string clears the fit (falls back to the default "Cover"); a non-empty value
        // must be one of the allowed modes. Null leaves the stored value untouched.
        if (headerImageFit != null
            && !string.IsNullOrWhiteSpace(headerImageFit)
            && !AllowedHeaderImageFits.Contains(headerImageFit))
        {
            throw new ValidationException(
                $"HeaderImageFit must be one of: {string.Join(", ", AllowedHeaderImageFits.Order())}.")
            {
                Code = ErrorCodes.BrandHeaderImageFitInvalid,
                Args = new Dictionary<string, object> { ["allowed"] = string.Join(", ", AllowedHeaderImageFits.Order()) }
            };
        }

        // The public address is what confirmation emails link to and what the native-app
        // readiness checks fetch from, so it has to be an address in the first place.
        if (websiteUrl != null
            && !string.IsNullOrWhiteSpace(websiteUrl)
            && !UrlValidator.IsValid(websiteUrl, UrlValidator.WebSchemes))
        {
            throw new ValidationException("Website URL must be an absolute http(s) URL.")
            { Code = ErrorCodes.BrandWebsiteUrlInvalid };
        }

        // Blank clears; anything else has to be a link a store reviewer can actually open.
        if (privacyPolicyUrl != null
            && !string.IsNullOrWhiteSpace(privacyPolicyUrl)
            && !UrlValidator.IsValid(privacyPolicyUrl, UrlValidator.WebSchemes))
        {
            throw new ValidationException("Privacy policy URL must be an absolute http(s) URL.")
            { Code = ErrorCodes.BrandPrivacyPolicyUrlInvalid };
        }

        if (minimumAppVersion != null
            && !string.IsNullOrWhiteSpace(minimumAppVersion)
            && !NativeAppVersion.IsValid(minimumAppVersion.Trim()))
        {
            throw new ValidationException("Minimum app version must be major.minor.patch, e.g. 1.9.0.")
            { Code = ErrorCodes.BrandMinimumAppVersionInvalid };
        }

        BrandSettings? brand = await _brandRepository.GetAsync();
        bool isNew = false;
        if (brand == null)
        {
            brand = new BrandSettings();
            isNew = true;
        }

        BrandFields before = BrandFields.From(brand);

        brand.AppName = appName ?? brand.AppName;
        brand.PrimaryColor = primaryColor ?? brand.PrimaryColor;
        brand.AccentColor = accentColor;
        if (faviconIcon != null)
        {
            brand.FaviconIcon = string.IsNullOrWhiteSpace(faviconIcon) ? null : faviconIcon;
        }
        if (websiteUrl != null)
        {
            brand.WebsiteUrl = string.IsNullOrWhiteSpace(websiteUrl) ? null : websiteUrl.Trim();
        }
        if (phoneNumber != null)
        {
            brand.PhoneNumber = ContactFields.NormalizePhone(phoneNumber);
        }
        if (emailAddress != null)
        {
            brand.EmailAddress = ContactFields.NormalizeEmail(emailAddress);
        }
        if (copyrightText != null)
        {
            brand.CopyrightText = string.IsNullOrWhiteSpace(copyrightText) ? null : copyrightText.Trim();
        }
        if (subtitle != null)
        {
            brand.Subtitle = string.IsNullOrWhiteSpace(subtitle) ? null : subtitle.Trim();
        }
        if (highlightsHeading != null)
        {
            brand.HighlightsHeading = string.IsNullOrWhiteSpace(highlightsHeading) ? null : highlightsHeading.Trim();
        }
        if (highlightsSubheading != null)
        {
            brand.HighlightsSubheading = string.IsNullOrWhiteSpace(highlightsSubheading) ? null : highlightsSubheading.Trim();
        }
        if (privacyPolicyUrl != null)
        {
            brand.PrivacyPolicyUrl = string.IsNullOrWhiteSpace(privacyPolicyUrl) ? null : privacyPolicyUrl.Trim();
        }
        if (minimumAppVersion != null)
        {
            brand.MinimumAppVersion = string.IsNullOrWhiteSpace(minimumAppVersion) ? null : minimumAppVersion.Trim();
        }
        // HeaderImageFit: blank/whitespace clears to null (→ default Cover). Normalize casing
        // of the allowed value (e.g. "contain" → "Contain") so persisted data is canonical.
        if (headerImageFit != null)
        {
            if (string.IsNullOrWhiteSpace(headerImageFit))
            {
                brand.HeaderImageFit = null;
            }
            else
            {
                brand.HeaderImageFit = AllowedHeaderImageFits.First(f =>
                    f.Equals(headerImageFit, StringComparison.OrdinalIgnoreCase));
            }
        }

        if (isNew)
        {
            await _brandRepository.AddAsync(brand);
        }
        else
        {
            await _brandRepository.SaveChangesAsync();
        }

        RecordBrandChanges(before, BrandFields.From(brand));
        _audit.Describe(AuditActions.BrandUpdate, AuditTargets.Brand, AuditTargets.IdOf(brand.Id),
            brand.AppName, summary: "Updated the brand settings");
    }

    /// <summary>The writable brand text/colour fields, snapshotted either side of the save.</summary>
    private sealed record BrandFields(
        string AppName,
        string PrimaryColor,
        string? AccentColor,
        string? FaviconIcon,
        string? WebsiteUrl,
        string? PhoneNumber,
        string? EmailAddress,
        string? CopyrightText,
        string? Subtitle,
        string? HighlightsHeading,
        string? HighlightsSubheading,
        string? HeaderImageFit,
        string? PrivacyPolicyUrl,
        string? MinimumAppVersion)
    {
        public static BrandFields From(BrandSettings b) => new(
            b.AppName, b.PrimaryColor, b.AccentColor, b.FaviconIcon, b.WebsiteUrl, b.PhoneNumber,
            b.EmailAddress, b.CopyrightText, b.Subtitle, b.HighlightsHeading,
            b.HighlightsSubheading, b.HeaderImageFit, b.PrivacyPolicyUrl, b.MinimumAppVersion);
    }

    private void RecordBrandChanges(BrandFields before, BrandFields after)
    {
        _audit.RecordChange("appName", before.AppName, after.AppName);
        _audit.RecordChange("primaryColor", before.PrimaryColor, after.PrimaryColor);
        _audit.RecordChange("accentColor", before.AccentColor, after.AccentColor);
        _audit.RecordChange("faviconIcon", before.FaviconIcon, after.FaviconIcon);
        _audit.RecordChange("websiteUrl", before.WebsiteUrl, after.WebsiteUrl);
        _audit.RecordChange("phoneNumber", before.PhoneNumber, after.PhoneNumber);
        _audit.RecordChange("emailAddress", before.EmailAddress, after.EmailAddress);
        _audit.RecordChange("copyrightText", before.CopyrightText, after.CopyrightText);
        _audit.RecordChange("subtitle", before.Subtitle, after.Subtitle);
        _audit.RecordChange("highlightsHeading", before.HighlightsHeading, after.HighlightsHeading);
        _audit.RecordChange("highlightsSubheading", before.HighlightsSubheading, after.HighlightsSubheading);
        _audit.RecordChange("headerImageFit", before.HeaderImageFit, after.HeaderImageFit);
        _audit.RecordChange("privacyPolicyUrl", before.PrivacyPolicyUrl, after.PrivacyPolicyUrl);
        _audit.RecordChange("minimumAppVersion", before.MinimumAppVersion, after.MinimumAppVersion);
    }
}
