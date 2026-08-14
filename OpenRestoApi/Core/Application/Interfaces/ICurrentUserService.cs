namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// The authenticated caller, read off the request's JWT claims. Lets services act on
/// "whoever is signed in" without taking a dependency on <c>HttpContext</c>, and keeps
/// self-service (change password/email/PVQ) targeting one specific user rather than a
/// global record.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// The caller's user id, or null when unauthenticated — or when the token predates
    /// multi-user support and carries no <c>sub</c> claim, in which case
    /// <see cref="Email"/> is the only usable identifier.
    /// </summary>
    int? UserId { get; }

    /// <summary>The caller's email claim, or null when unauthenticated.</summary>
    string? Email { get; }

    /// <summary>The caller's role claim, or null when unauthenticated.</summary>
    string? Role { get; }
}
