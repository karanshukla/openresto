using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/auth")]
[EnableRateLimiting("auth")]
public class AuthController(AuthService authService) : ControllerBase
{
    private readonly AuthService _authService = authService;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        string? jwt = await _authService.LoginAsync(req.Email, req.Password);
        if (jwt == null)
            return Unauthorized(new { message = "Invalid email or password." });
        SetAuthCookie(jwt);
        return Ok(new { message = "Login successful." });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        bool isProduction = !string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

        Response.Cookies.Delete("openresto_auth", new CookieOptions
        {
            Path = "/",
            Secure = isProduction,
            SameSite = isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
        });
        return Ok(new { message = "Logged out." });
    }

    [HttpGet("me")]
    [Authorize]
    [EnableRateLimiting("public")]
    public IActionResult Me()
    {
        string? email = User.FindFirst(ClaimTypes.Email)?.Value;
        return Ok(new { email });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (req.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        bool ok = await _authService.ChangePasswordAsync(req.CurrentPassword, req.NewPassword);
        if (!ok)
            return Unauthorized(new { message = "Current password is incorrect." });
        return Ok(new { message = "Password changed successfully." });
    }

    [HttpPost("change-email")]
    [Authorize]
    public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest req)
    {
        string trimmedEmail = req.NewEmail?.Trim() ?? string.Empty;
        if (!EmailValidator.IsValid(trimmedEmail))
            return BadRequest(new { message = "A valid email address is required." });

        try
        {
            string? jwt = await _authService.ChangeEmailAsync(req.CurrentPassword, trimmedEmail);
            if (jwt == null)
                return Unauthorized(new { message = "Current password is incorrect." });
            SetAuthCookie(jwt);
            return Ok(new { message = "Email changed successfully.", email = trimmedEmail.ToLowerInvariant() });
        }
        catch (InvalidOperationException)
        {
            return BadRequest(new { message = "New email must be different from the current email." });
        }
    }

    [HttpGet("pvq")]
    public async Task<IActionResult> GetPvqStatus()
    {
        return Ok(await _authService.GetPvqStatusAsync());
    }

    [HttpPost("pvq/setup")]
    [Authorize]
    public async Task<IActionResult> SetupPvq([FromBody] SetupPvqRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
            return BadRequest(new { message = "Question and answer are required." });

        await _authService.SetupPvqAsync(req.Question, req.Answer);
        return Ok(new { message = "Security question configured." });
    }

    [HttpPost("pvq/verify")]
    public async Task<IActionResult> VerifyPvq([FromBody] VerifyPvqRequest req)
    {
        PvqVerifyOutcome outcome = await _authService.VerifyPvqAsync(req.Email, req.Answer);
        return outcome.Status switch
        {
            PvqVerifyStatus.NotConfigured => BadRequest(new { message = "Security question not configured for this account." }),
            PvqVerifyStatus.WrongAnswer => Unauthorized(new { message = "Incorrect answer." }),
            _ => Ok(new { resetToken = outcome.ResetToken })
        };
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (req.NewPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        bool ok = await _authService.ResetPasswordAsync(req.ResetToken, req.NewPassword);
        if (!ok)
            return BadRequest(new { message = "Invalid or expired reset token." });
        return Ok(new { message = "Password reset successfully." });
    }

    private void SetAuthCookie(string jwt)
    {
        bool isProduction = !string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
            "Development",
            StringComparison.OrdinalIgnoreCase);

        Response.Cookies.Append("openresto_auth", jwt, new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction,
            SameSite = isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(30),
        });
    }
}
