using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/brand")]
[EnableRateLimiting("public")]
public class BrandController(BrandService brandService) : ControllerBase
{
    private readonly BrandService _brand = brandService;

    [HttpGet]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get()
    {
        var brand = await _brand.GetAsync();
        return Ok(new BrandResponse
        {
            AppName = brand.AppName ?? "Open Resto",
            PrimaryColor = brand.PrimaryColor ?? "#0a7ea4",
            AccentColor = brand.AccentColor,
            LogoUrl = brand.LogoBase64,
        });
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Save([FromBody] BrandRequest req)
    {
        try
        {
            await _brand.SaveAsync(req.AppName, req.PrimaryColor, req.AccentColor, req.LogoBase64);
            return Ok(new { message = "Brand settings saved." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public class BrandRequest
{
    public string? AppName { get; set; }
    public string? PrimaryColor { get; set; }
    public string? AccentColor { get; set; }
    public string? LogoBase64 { get; set; }
}

public class BrandResponse
{
    public string AppName { get; set; } = "Open Resto";
    public string PrimaryColor { get; set; } = "#0a7ea4";
    public string? AccentColor { get; set; }
    public string? LogoUrl { get; set; }
}
