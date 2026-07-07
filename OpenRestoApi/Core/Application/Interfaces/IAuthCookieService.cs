namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Manages the <c>openresto_auth</c> HttpOnly cookie that carries the admin JWT.
/// Cookie options (Secure, SameSite, Path, 30-day expiry) are owned here so
/// <c>AuthController</c> stays a thin HTTP mapper and the env detection is
/// resolved via <c>IWebHostEnvironment</c> rather than environment-variable sniffing.
/// </summary>
public interface IAuthCookieService
{
    /// <summary>Appends the JWT to the response as an HttpOnly cookie.</summary>
    void SetCookie(HttpResponse response, string jwt);

    /// <summary>Deletes the auth cookie (logout).</summary>
    void Clear(HttpResponse response);
}
