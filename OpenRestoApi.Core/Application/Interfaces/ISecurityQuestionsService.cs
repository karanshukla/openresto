using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Personal Verification Question (PVQ) lifecycle — the "forgot password" reset flow.
/// Answer hashing reuses <see cref="IPasswordService"/> after trim/lower normalisation.
/// Every question is per-account: the public lookup is keyed by email (the forgot-password
/// screen has no session yet), setup targets the signed-in caller.
/// </summary>
public interface ISecurityQuestionsService
{
    /// <summary>The question configured for <paramref name="email"/>, for the forgot-password screen.</summary>
    Task<PvqStatusDto> GetStatusAsync(string email);

    /// <summary>The signed-in caller's own question, for the settings screen.</summary>
    Task<PvqStatusDto> GetStatusForCurrentUserAsync();

    Task SetupAsync(string question, string answer);
    Task<PvqVerifyOutcome> VerifyAsync(string email, string answer);
}
