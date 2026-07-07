using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Personal Verification Question (PVQ) lifecycle — the "forgot password" reset flow.
/// Answer hashing reuses <see cref="IPasswordService"/> after trim/lower normalisation.
/// </summary>
public interface ISecurityQuestionsService
{
    Task<PvqStatusDto> GetStatusAsync();
    Task SetupAsync(string question, string answer);
    Task<PvqVerifyOutcome> VerifyAsync(string email, string answer);
}
