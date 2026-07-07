using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/auth")]
[EnableRateLimiting("auth")]
public class AuthController(
    IAuthService authService,
    ISecurityQuestionsService securityQuestions,
    IAuthCookieService cookies) : ControllerBase
{
    private readonly IAuthService _authService = authService;
    private readonly ISecurityQuestionsService _securityQuestions = securityQuestions;
    private readonly IAuthCookieService _cookies = cookies;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        string? jwt = await _authService.LoginAsync(req.Email, req.Password);
        if (jwt == null)
            return Unauthorized(new { message = "Invalid email or password." });
        _cookies.SetCookie(Response, jwt);
        return Ok(new { message = "Login successful." });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        _cookies.Clear(Response);
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
        // ValidationException (short password) → 400 is mapped by GlobalExceptionHandler.
        bool ok = await _authService.ChangePasswordAsync(req.CurrentPassword, req.NewPassword);
        if (!ok)
            return Unauthorized(new { message = "Current password is incorrect." });
        return Ok(new { message = "Password changed successfully." });
    }

    [HttpPost("change-email")]
    [Authorize]
    public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest req)
    {
        // ValidationException (invalid email) and BusinessRuleException (same email)
        // → 400 are mapped by GlobalExceptionHandler; the BusinessRuleException's
        // message is "New email must be different from the current email.".
        string? jwt = await _authService.ChangeEmailAsync(req.CurrentPassword, req.NewEmail ?? string.Empty);
        if (jwt == null)
            return Unauthorized(new { message = "Current password is incorrect." });
        _cookies.SetCookie(Response, jwt);
        return Ok(new { message = "Email changed successfully.", email = req.NewEmail!.Trim().ToLowerInvariant() });
    }

    [HttpGet("pvq")]
    public async Task<IActionResult> GetPvqStatus()
    {
        return Ok(await _securityQuestions.GetStatusAsync());
    }

    [HttpPost("pvq/setup")]
    [Authorize]
    public async Task<IActionResult> SetupPvq([FromBody] SetupPvqRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
            return BadRequest(new { message = "Question and answer are required." });

        await _securityQuestions.SetupAsync(req.Question, req.Answer);
        return Ok(new { message = "Security question configured." });
    }

    [HttpPost("pvq/verify")]
    public async Task<IActionResult> VerifyPvq([FromBody] VerifyPvqRequest req)
    {
        PvqVerifyOutcome outcome = await _securityQuestions.VerifyAsync(req.Email, req.Answer);
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
        // ValidationException (short password) → 400 is mapped by GlobalExceptionHandler.
        bool ok = await _authService.ResetPasswordAsync(req.ResetToken, req.NewPassword);
        if (!ok)
            return BadRequest(new { message = "Invalid or expired reset token." });
        return Ok(new { message = "Password reset successfully." });
    }
}
