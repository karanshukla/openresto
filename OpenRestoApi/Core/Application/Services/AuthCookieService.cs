using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Writes/clears the <c>openresto_auth</c> cookie. SameSite/Secure flags are derived from
/// <see cref="IWebHostEnvironment"/>, matching the prior controller behaviour: dev (HTTP,
/// cross-origin ports) uses Lax + no Secure; production (HTTPS) uses Strict + Secure. Extracted
/// from <c>AuthController</c> so the env check isn't duplicated between login and logout.
/// </summary>
public sealed class AuthCookieService(IWebHostEnvironment env) : IAuthCookieService
{
    private const string _cookieName = "openresto_auth";
    private readonly bool _isProduction = !env.IsDevelopment();

    public void SetCookie(HttpResponse response, string jwt)
    {
        response.Cookies.Append(_cookieName, jwt, new CookieOptions
        {
            HttpOnly = true,
            Secure = _isProduction,
            SameSite = _isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(30),
        });
    }

    public void Clear(HttpResponse response)
    {
        response.Cookies.Delete(_cookieName, new CookieOptions
        {
            Path = "/",
            Secure = _isProduction,
            SameSite = _isProduction ? SameSiteMode.Strict : SameSiteMode.Lax,
        });
    }
}
