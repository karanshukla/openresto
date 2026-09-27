using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// The no-op every service falls back to when no current-user context was injected — a
/// hand-constructed service in a unit test, or any code path running outside a request. Reports
/// "not an API key", the same "nothing scoped, nothing restricted" stance a JWT/browser session
/// has, so guest-visibility redaction (<see cref="Utilities.BookingGuestVisibility"/>) never
/// triggers for it and every existing caller keeps seeing full booking rows.
/// </summary>
public sealed class NullCurrentUserService : ICurrentUserService
{
    public static readonly ICurrentUserService Instance = new NullCurrentUserService();

    private NullCurrentUserService() { }

    public int? UserId => null;
    public string? Email => null;
    public string? Role => null;
    public bool IsApiKeyAuthenticated => false;
    public int? KeyId => null;
    public bool HasScope(string resource, string access) => true;
}
