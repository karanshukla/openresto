using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/brand")]
[EnableRateLimiting("public")]
public class BrandController(BrandService brandService) : ControllerBase
{
    private readonly BrandService _brand = brandService;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        BrandSettings brand = await _brand.GetAsync();
        return Ok(new BrandResponse
        {
            AppName = brand.AppName ?? "Open Resto",
            PrimaryColor = brand.PrimaryColor ?? "#0a7ea4",
            AccentColor = brand.AccentColor,
            HeaderImageUrl = brand.HeaderImageUrl,
            WebsiteUrl = _brand.GetWebsiteUrl(brand),
            FaviconIcon = brand.FaviconIcon,
            CopyrightText = brand.CopyrightText,
        });
    }

    [HttpGet("pwa-icon.svg")]
    public async Task<IActionResult> GetPwaIcon()
    {
        BrandSettings brand = await _brand.GetAsync();
        if (string.IsNullOrEmpty(brand.FaviconIcon))
        {
            return NotFound();
        }

        string? paths = LucideIconPaths.Get(brand.FaviconIcon);
        if (paths == null)
        {
            return NotFound();
        }

        string color = brand.PrimaryColor ?? "#0a7ea4";
        string svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="22" ry="22" fill="{color}"/>
              <g transform="translate(20,20) scale(2.5)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                {paths}
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

        BrandSettings brand = await _brand.GetAsync();
        if (string.IsNullOrEmpty(brand.FaviconIcon))
        {
            return NotFound();
        }

        string? paths = LucideIconPaths.Get(brand.FaviconIcon);
        if (paths == null)
        {
            return NotFound();
        }

        byte[] png = PwaIconGenerator.Generate(size, brand.PrimaryColor ?? "#0a7ea4", paths);
        Response.Headers.CacheControl = "no-cache";
        return File(png, "image/png");
    }

    [HttpPatch]
    [Authorize]
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
            req.CopyrightText);
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

    [StringLength(200, ErrorMessage = "Copyright text cannot exceed 200 characters.")]
    public string? CopyrightText { get; set; }
}

public class BrandResponse
{
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }
    public string? HeaderImageUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? FaviconIcon { get; set; }
    public string? CopyrightText { get; set; }
}
