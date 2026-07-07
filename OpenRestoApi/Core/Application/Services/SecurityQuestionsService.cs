using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public enum PvqVerifyStatus { NotConfigured, WrongAnswer, Success }
public record PvqVerifyOutcome(PvqVerifyStatus Status, string? ResetToken = null);

/// <inheritdoc cref="ISecurityQuestionsService" />
public sealed class SecurityQuestionsService(
    IAdminCredentialRepository credentialRepository,
    IPasswordService passwordService,
    IConfiguration config) : ISecurityQuestionsService
{
    private readonly IAdminCredentialRepository _credentialRepository = credentialRepository;
    private readonly IPasswordService _passwordService = passwordService;
    private readonly IConfiguration _config = config;

    public async Task<PvqStatusDto> GetStatusAsync()
    {
        AdminCredential? cred = await _credentialRepository.GetAsync();
        return new PvqStatusDto
        {
            IsConfigured = cred?.PvqQuestion != null,
            Question = cred?.PvqQuestion,
        };
    }

    public async Task SetupAsync(string question, string answer)
    {
        AdminCredential cred = await GetOrCreateCredentialAsync();
        (cred.PvqAnswerHash, cred.PvqAnswerSalt) = _passwordService.Hash(NormaliseAnswer(answer));
        cred.PvqQuestion = question.Trim();
        await _credentialRepository.SaveChangesAsync();
    }

    public async Task<PvqVerifyOutcome> VerifyAsync(string email, string answer)
    {
        AdminCredential? cred = await _credentialRepository.GetByEmailAsync(email);

        if (cred?.PvqAnswerHash == null || cred.PvqAnswerSalt == null)
            return new PvqVerifyOutcome(PvqVerifyStatus.NotConfigured);

        if (!_passwordService.Verify(NormaliseAnswer(answer), cred.PvqAnswerHash, cred.PvqAnswerSalt))
            return new PvqVerifyOutcome(PvqVerifyStatus.WrongAnswer);

        string token = Guid.NewGuid().ToString("N");
        cred.ResetToken = token;
        cred.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);
        await _credentialRepository.SaveChangesAsync();
        return new PvqVerifyOutcome(PvqVerifyStatus.Success, token);
    }

    // Same bootstrap precedence as AuthService.GetOrCreateCredentialAsync: config first, then
    // env vars, then hardcoded default email / throw-on-missing password. SetupPvq is
    // [Authorize]-gated so this branch only runs if the row was never seeded by first login.
    private async Task<AdminCredential> GetOrCreateCredentialAsync()
    {
        AdminCredential? cred = await _credentialRepository.GetAsync();
        if (cred != null) return cred;

        string? configEmail = _config["Admin:Email"];
        string email = !string.IsNullOrWhiteSpace(configEmail)
            ? configEmail
            : Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@openresto.com";

        string? configPassword = _config["Admin:Password"];
        string? password = !string.IsNullOrWhiteSpace(configPassword)
            ? configPassword
            : Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

        if (string.IsNullOrWhiteSpace(password))
            throw new InfrastructureException(
                "Admin:Password must be configured before first use. Set it via ADMIN_PASSWORD env var.");

        (string hash, string salt) = _passwordService.Hash(password);
        cred = new AdminCredential { Email = email, PasswordHash = hash, PasswordSalt = salt };
        await _credentialRepository.AddAsync(cred);
        return cred;
    }

    private static string NormaliseAnswer(string answer) => answer.Trim().ToLowerInvariant();
}
