using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/brand")]
[EnableRateLimiting("public")]
public class BrandController(BrandService brandService) : ControllerBase
{
    private const string DefaultPrimaryColor = "#0a7ea4";

    private readonly BrandService _brand = brandService;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        BrandSettings brand = await _brand.GetAsync();
        return Ok(new BrandResponse
        {
            AppName = brand.AppName ?? "Open Resto",
            PrimaryColor = brand.PrimaryColor ?? DefaultPrimaryColor,
            AccentColor = brand.AccentColor,
            HeaderImageUrl = brand.HeaderImageUrl,
            WebsiteUrl = _brand.GetWebsiteUrl(brand),
            PhoneNumber = brand.PhoneNumber,
            EmailAddress = brand.EmailAddress,
            FaviconIcon = brand.FaviconIcon,
            CopyrightText = brand.CopyrightText,
            Subtitle = brand.Subtitle,
            HighlightsHeading = brand.HighlightsHeading,
            HighlightsSubheading = brand.HighlightsSubheading,
            HeaderImageFit = brand.HeaderImageFit,
            PrivacyPolicyUrl = brand.PrivacyPolicyUrl,
            MinimumAppVersion = brand.MinimumAppVersion,
            DefaultLocale = _brand.GetDefaultLocale(brand),
            CliPackageUrl = _brand.GetCliPackageUrl(),
            ApiDocsUrl = _brand.GetApiDocsUrl(),
            RepositoryUrl = _brand.GetRepositoryUrl(),
        });
    }

    /// <summary>The brand colour and Lucide path data an icon endpoint draws, or null when the brand has no drawable icon.</summary>
    private sealed record BrandIcon(string Color, string Paths);

    private async Task<BrandIcon?> ResolveIconAsync()
    {
        BrandSettings brand = await _brand.GetAsync();
        if (string.IsNullOrEmpty(brand.FaviconIcon))
        {
            return null;
        }

        string? paths = LucideIconPaths.Get(brand.FaviconIcon);
        return paths == null ? null : new BrandIcon(brand.PrimaryColor ?? DefaultPrimaryColor, paths);
    }

    private FileContentResult IconFile(byte[] png)
    {
        Response.Headers.CacheControl = "no-cache";
        return File(png, "image/png");
    }

    [HttpGet("pwa-icon.svg")]
    public async Task<IActionResult> GetPwaIcon()
    {
        BrandIcon? icon = await ResolveIconAsync();
        if (icon == null)
        {
            return NotFound();
        }

        string svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="22" ry="22" fill="{icon.Color}"/>
              <g transform="translate(20,20) scale(2.5)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                {icon.Paths}
              </g>
            </svg>
            """;

        Response.Headers.CacheControl = "no-cache";
        return Content(svg, "image/svg+xml");
    }

    [HttpGet("pwa-icon-{size}.png")]
    public async Task<IActionResult> GetPwaIconPng(int size)
    {
        if (size != 192 && size != 512)
        {
            return NotFound();
        }

        BrandIcon? icon = await ResolveIconAsync();
        if (icon == null)
        {
            return NotFound();
        }

        return IconFile(PwaIconGenerator.Generate(size, icon.Color, icon.Paths));
    }

    /// <summary>
    /// The iOS app icon a self-hoster's native build bakes in. Deliberately not a
    /// <c>pwa-icon-1024.png</c>: the PWA shape carries the transparency App Store Connect rejects.
    /// </summary>
    [HttpGet("app-icon-ios.png")]
    public async Task<IActionResult> GetAppIconIos()
    {
        BrandIcon? icon = await ResolveIconAsync();
        if (icon == null)
        {
            return NotFound();
        }

        return IconFile(PwaIconGenerator.GenerateAppStoreIcon(icon.Color, icon.Paths));
    }

    /// <summary>The foreground layer of the Android adaptive icon; the background layer is the brand colour from <c>GET api/brand</c>.</summary>
    [HttpGet("app-icon-android-foreground.png")]
    public async Task<IActionResult> GetAppIconAndroidForeground()
    {
        BrandIcon? icon = await ResolveIconAsync();
        if (icon == null)
        {
            return NotFound();
        }

        return IconFile(PwaIconGenerator.GenerateAdaptiveForeground(icon.Color, icon.Paths));
    }

    [HttpPatch]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [RequiresScope(ApiKeyScopes.Brand, ApiKeyScopes.Write)]
    public async Task<IActionResult> Save([FromBody] BrandRequest req)
    {
        // ValidationException (bad app-name/color/favicon/copyright) → 400 is mapped
        // by GlobalExceptionHandler.
        await _brand.SaveAsync(
            req.AppName,
            req.PrimaryColor,
            req.AccentColor,
            req.FaviconIcon,
            req.WebsiteUrl,
            req.PhoneNumber,
            req.EmailAddress,
            req.CopyrightText,
            req.Subtitle,
            req.HighlightsHeading,
            req.HighlightsSubheading,
            req.HeaderImageFit,
            req.PrivacyPolicyUrl,
            req.MinimumAppVersion);
        return Ok(new { message = "Brand settings saved." });
    }
}

public class BrandRequest
{
    [StringLength(32, ErrorMessage = "App name cannot exceed 32 characters.")]
    public string? AppName { get; set; }
    public string? PrimaryColor { get; set; }
    public string? AccentColor { get; set; }
    public string? FaviconIcon { get; set; }
    public string? WebsiteUrl { get; set; }

    /// <summary>Default contact phone. Empty string clears it; null leaves the stored value unchanged.</summary>
    [StringLength(ContactLimits.MaxPhoneLength, ErrorMessage = "Phone number cannot exceed 32 characters.")]
    public string? PhoneNumber { get; set; }

    /// <summary>Default contact email. Empty string clears it; null leaves the stored value unchanged.</summary>
    [StringLength(ContactLimits.MaxEmailLength, ErrorMessage = "Email address cannot exceed 254 characters.")]
    public string? EmailAddress { get; set; }

    [StringLength(200, ErrorMessage = "Copyright text cannot exceed 200 characters.")]
    public string? CopyrightText { get; set; }

    [StringLength(160, ErrorMessage = "Subtitle cannot exceed 160 characters.")]
    public string? Subtitle { get; set; }

    [StringLength(60, ErrorMessage = "Highlights heading cannot exceed 60 characters.")]
    public string? HighlightsHeading { get; set; }

    [StringLength(60, ErrorMessage = "Highlights subheading cannot exceed 60 characters.")]
    public string? HighlightsSubheading { get; set; }

    /// <summary>"Cover" (default) or "Contain". Null means leave the stored value unchanged.</summary>
    public string? HeaderImageFit { get; set; }

    /// <summary>Absolute http(s) URL. Empty string clears it; null leaves the stored value unchanged.</summary>
    [StringLength(2048, ErrorMessage = "Privacy policy URL cannot exceed 2048 characters.")]
    public string? PrivacyPolicyUrl { get; set; }

    /// <summary>Strict <c>major.minor.patch</c>. Empty string clears it; null leaves the stored value unchanged.</summary>
    [StringLength(NativeAppVersion.MaxLength, ErrorMessage = "Minimum app version cannot exceed 32 characters.")]
    public string? MinimumAppVersion { get; set; }
}

public class BrandResponse
{
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? PhoneNumber { get; set; }
    public string? EmailAddress { get; set; }
    public string? FaviconIcon { get; set; }
    public string? CopyrightText { get; set; }
    public string? Subtitle { get; set; }
    public string? HighlightsHeading { get; set; }
    public string? HighlightsSubheading { get; set; }
    public string? HeaderImageFit { get; set; }

    /// <summary>Where this instance publishes its privacy policy, or null when none is set.</summary>
    public string? PrivacyPolicyUrl { get; set; }

    /// <summary>The oldest native app version this server supports, or null when every build is accepted.</summary>
    public string? MinimumAppVersion { get; set; }

    public string DefaultLocale { get; set; } = SupportedLocales.Default;

    /// <summary>Where the CLI this server's API keys drive is published. See <see cref="BrandService.GetCliPackageUrl"/>.</summary>
    public string? CliPackageUrl { get; set; }

    /// <summary>The guide to calling this API over raw HTTP with a key.</summary>
    public string? ApiDocsUrl { get; set; }

    /// <summary>The source repository this deployment is built from.</summary>
    public string? RepositoryUrl { get; set; }
}
