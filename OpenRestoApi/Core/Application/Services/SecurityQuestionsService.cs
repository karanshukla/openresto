using System.Globalization;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public enum PvqVerifyStatus { NotConfigured, WrongAnswer, Success }
public record PvqVerifyOutcome(PvqVerifyStatus Status, string? ResetToken = null);

/// <inheritdoc cref="ISecurityQuestionsService" />
public sealed class SecurityQuestionsService(
    IAdminCredentialRepository credentialRepository,
    IPasswordService passwordService,
    ICurrentUserService currentUser,
    IAuditScope? audit = null) : ISecurityQuestionsService
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly ICurrentUserService _currentUser = currentUser;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public async Task<PvqStatusDto> GetStatusAsync(string email)
    {
        AdminCredential? cred = string.IsNullOrWhiteSpace(email)
            ? null
            : await _credentialRepository.GetByEmailAsync(email);
        // A deactivated account reports no question, matching what VerifyAsync would answer —
        // offering the question and then refusing the answer would be a dead end, and it would
        // tell an unauthenticated caller that the address exists.
        return ToStatus(cred?.IsActive == true ? cred : null);
    }

    public async Task<PvqStatusDto> GetStatusForCurrentUserAsync()
    {
        return ToStatus(await ResolveCurrentUserAsync());
    }

    public async Task SetupAsync(string question, string answer)
    {
        AdminCredential cred = await ResolveCurrentUserAsync()
            ?? throw new NotFoundException("No account matches the signed-in session.");
        (cred.PvqAnswerHash, cred.PvqAnswerSalt) = _passwordService.Hash(NormaliseAnswer(answer));
        cred.PvqQuestion = question.Trim();
        await _credentialRepository.SaveChangesAsync();

        // Neither the question nor the answer is recorded: together they are a credential, and the
        // question alone narrows a guess at the answer.
        _audit.Describe(AuditActions.AuthPvqSetup, AuditTargets.User, cred.Id.ToString(CultureInfo.InvariantCulture),
            cred.DisplayName ?? cred.Email, summary: "Configured a security question");
    }

    public async Task<PvqVerifyOutcome> VerifyAsync(string email, string answer)
    {
        AdminCredential? cred = await _credentialRepository.GetByEmailAsync(email);

        // A deactivated account must not be resettable back into use via the public flow.
        if (cred?.IsActive != true || cred.PvqAnswerHash == null || cred.PvqAnswerSalt == null)
            return new PvqVerifyOutcome(PvqVerifyStatus.NotConfigured);

        if (!_passwordService.Verify(NormaliseAnswer(answer), cred.PvqAnswerHash, cred.PvqAnswerSalt))
            return new PvqVerifyOutcome(PvqVerifyStatus.WrongAnswer);

        string token = Guid.NewGuid().ToString("N");
        cred.ResetToken = token;
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _credentialRepository.SaveChangesAsync();
        return new PvqVerifyOutcome(PvqVerifyStatus.Success, token);
    }

    private static PvqStatusDto ToStatus(AdminCredential? cred) => new()
    {
        IsConfigured = cred?.PvqQuestion != null,
        Question = cred?.PvqQuestion,
    };

    private Task<AdminCredential?> ResolveCurrentUserAsync()
        => CurrentUserResolver.ResolveAsync(_currentUser, _credentialRepository);

    private static string NormaliseAnswer(string answer) => answer.Trim().ToLowerInvariant();
}
