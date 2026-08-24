using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Controllers;

[ApiController]
[Route("api/admin/auth")]
[EnableRateLimiting("auth")]
public class AuthController(
    IAuthService authService,
    ISecurityQuestionsService securityQuestions,
    IAuthCookieService cookies,
    IAuditScope? audit = null) : ControllerBase
{
    private readonly IAuthService _authService = authService;
    private readonly ISecurityQuestionsService _securityQuestions = securityQuestions;
    private readonly IAuthCookieService _cookies = cookies;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        string? jwt = await _authService.LoginAsync(req.Email, req.Password);
        if (jwt == null)
            return Unauthorized(new { message = "Invalid email or password." });
        _cookies.SetCookie(Response, jwt);
        return Ok(new { message = "Login successful." });
    }

    /// <summary>
    /// The endpoint takes no token by design — clearing a cookie that was never set has to
    /// succeed — so an anonymous POST would land an actor-less row, and could be repeated to bury
    /// the entries that matter. Only a real session is recorded.
    /// <seealso>AuditTrailTests.Logout_IsRecordedForASessionAndIgnoredWithoutOne</seealso>
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        _cookies.Clear(Response);
        if (User.Identity?.IsAuthenticated == true)
        {
            _audit.Describe(AuditActions.AuthLogout, summary: "Signed out");
        }
        return Ok(new { message = "Logged out." });
    }

    [HttpGet("me")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    [EnableRateLimiting("public")]
    public async Task<IActionResult> Me()
    {
        CurrentUserDto? user = await _authService.GetCurrentUserAsync();
        // A structurally-valid token whose account has been deleted or deactivated is no
        // longer a session — the frontend treats the 401 as "signed out".
        if (user == null)
            return Unauthorized(new { message = "Session no longer matches an active account." });
        return Ok(user);
    }

    [HttpPost("change-password")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        // ValidationException (short password) → 400 is mapped by GlobalExceptionHandler.
        bool ok = await _authService.ChangePasswordAsync(req.CurrentPassword, req.NewPassword);
        if (!ok)
            return Unauthorized(new { message = "Current password is incorrect." });
        return Ok(new { message = "Password changed successfully." });
    }

    [HttpPost("change-email")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
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

    /// <summary>
    /// The security question for a given account, for the forgot-password screen (which has no
    /// session yet). This confirms whether an address has an account with a question configured
    /// — an accepted trade-off for a self-hosted, internal tool, bounded by the <c>auth</c>
    /// rate-limit policy. The signed-in equivalent is <c>GET pvq/me</c>.
    /// </summary>
    [HttpGet("pvq")]
    public async Task<IActionResult> GetPvqStatus([FromQuery] string? email)
    {
        return Ok(await _securityQuestions.GetStatusAsync(email ?? string.Empty));
    }

    [HttpGet("pvq/me")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> GetMyPvqStatus()
    {
        return Ok(await _securityQuestions.GetStatusForCurrentUserAsync());
    }

    [HttpPost("pvq/setup")]
    [Authorize(Policy = AuthPolicies.RequireAdmin)]
    public async Task<IActionResult> SetupPvq([FromBody] SetupPvqRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question) || string.IsNullOrWhiteSpace(req.Answer))
            throw new ValidationException("Question and answer are required.") { Code = ErrorCodes.AuthPvqFieldsRequired };

        await _securityQuestions.SetupAsync(req.Question, req.Answer);
        return Ok(new { message = "Security question configured." });
    }

    [HttpPost("pvq/verify")]
    public async Task<IActionResult> VerifyPvq([FromBody] VerifyPvqRequest req)
    {
        PvqVerifyOutcome outcome = await _securityQuestions.VerifyAsync(req.Email, req.Answer);
        return outcome.Status switch
        {
            PvqVerifyStatus.NotConfigured => throw new ValidationException("Security question not configured for this account.") { Code = ErrorCodes.AuthPvqNotConfigured },
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
            throw new ValidationException("Invalid or expired reset token.") { Code = ErrorCodes.AuthInvalidResetToken };
        return Ok(new { message = "Password reset successfully." });
    }
}
