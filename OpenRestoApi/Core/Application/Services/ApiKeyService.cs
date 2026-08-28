using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Owner-facing management of admin API keys (issue #319 Phase 1): mint, list and revoke a
/// credential for the headless CLI. Every key is scoped to the calling Owner's own account —
/// there is no "mint a key for someone else" here, matching a personal-access-token model rather
/// than the account-wide reach <see cref="UserService"/> has over other users.
/// </summary>
public class ApiKeyService(
    IAdminApiKeyRepository apiKeyRepository,
    ICurrentUserService currentUser,
    ISystemClock clock,
    IAuditScope? audit = null)
{
    private readonly IAdminApiKeyRepository _apiKeyRepository = apiKeyRepository;
    private readonly ICurrentUserService _currentUser = currentUser;
    private readonly ISystemClock _clock = clock;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public async Task<List<ApiKeyDto>> GetAllAsync()
    {
        List<AdminApiKey> keys = await _apiKeyRepository.GetByUserIdAsync(RequireCallerId());
        return keys.Select(ToDto).ToList();
    }

    /// <summary>
    /// Mints a new key. The row is inserted twice on purpose: the raw key embeds the row's own
    /// id (so a lookup can narrow to one row before hashing anything), which does not exist until
    /// the first insert assigns it. The transient row between the two writes carries a random
    /// placeholder hash — never a fixed sentinel — so two concurrent creates can't collide on the
    /// unique index before either gets its real value.
    /// </summary>
    public async Task<ApiKeyCreatedDto> CreateAsync(CreateApiKeyRequest req)
    {
        int userId = RequireCallerId();
        string name = NormalizeName(req.Name);
        List<ApiKeyScopeDto> scopes = NormalizeScopes(req.Scopes);
        DateTime? expiresAt = NormalizeExpiresAt(req.ExpiresAt);

        var entity = new AdminApiKey
        {
            UserId = userId,
            Name = name,
            ScopesJson = ApiKeyScopeDto.Serialize(scopes),
            CreatedAt = _clock.UtcNow,
            ExpiresAt = expiresAt,
            KeyHash = Guid.NewGuid().ToString("N"),
            Prefix = "pending",
        };
        await _apiKeyRepository.AddAsync(entity);

        string rawKey = ApiKeyCrypto.GenerateRawKey(entity.Id);
        entity.KeyHash = ApiKeyCrypto.Hash(rawKey);
        entity.Prefix = ApiKeyCrypto.DisplayPrefix(rawKey);
        await _apiKeyRepository.SaveChangesAsync();

        Describe(AuditActions.ApiKeyCreate, entity, $"Created the API key \"{entity.Name}\"");

        ApiKeyDto dto = ToDto(entity);
        return new ApiKeyCreatedDto
        {
            Id = dto.Id,
            Name = dto.Name,
            Prefix = dto.Prefix,
            Scopes = dto.Scopes,
            CreatedAt = dto.CreatedAt,
            LastUsedAt = dto.LastUsedAt,
            ExpiresAt = dto.ExpiresAt,
            RevokedAt = dto.RevokedAt,
            Secret = rawKey,
        };
    }

    /// <summary>
    /// Soft-revokes a key. Idempotent: revoking an already-revoked key is a no-op that still
    /// returns the current row rather than erroring, so a retried request can't fail on the
    /// second attempt.
    /// </summary>
    public async Task<ApiKeyDto> RevokeAsync(int id)
    {
        AdminApiKey key = await RequireOwnKeyAsync(id);

        if (key.RevokedAt is null)
        {
            key.RevokedAt = _clock.UtcNow;
            await _apiKeyRepository.SaveChangesAsync();
            Describe(AuditActions.ApiKeyRevoke, key, $"Revoked the API key \"{key.Name}\"");
        }

        return ToDto(key);
    }

    private void Describe(string action, AdminApiKey key, string summary)
        => _audit.Describe(action, AuditTargets.ApiKey, AuditTargets.IdOf(key.Id), key.Name, summary: summary);

    private async Task<AdminApiKey> RequireOwnKeyAsync(int id)
    {
        AdminApiKey? key = await _apiKeyRepository.GetByIdAsync(id);
        if (key is null || key.UserId != RequireCallerId())
        {
            throw new NotFoundException($"API key {id} not found.") { Code = ErrorCodes.ApiKeyNotFound, Args = new Dictionary<string, object> { ["id"] = id } };
        }

        return key;
    }

    private int RequireCallerId()
        => _currentUser.UserId
            ?? throw new BusinessRuleException("The calling account could not be identified.");

    private static ApiKeyDto ToDto(AdminApiKey key) => new()
    {
        Id = key.Id,
        Name = key.Name,
        Prefix = key.Prefix,
        Scopes = ApiKeyScopeDto.ParseList(key.ScopesJson),
        CreatedAt = key.CreatedAt,
        LastUsedAt = key.LastUsedAt,
        ExpiresAt = key.ExpiresAt,
        RevokedAt = key.RevokedAt,
    };

    private static string NormalizeName(string? name)
    {
        string trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            throw new ValidationException("API key name cannot be empty.") { Code = ErrorCodes.ApiKeyNameRequired };
        }
        if (trimmed.Length > ApiKeyFields.MaxNameLength)
        {
            throw new ValidationException($"API key name cannot exceed {ApiKeyFields.MaxNameLength} characters.")
            { Code = ErrorCodes.ApiKeyNameTooLong, Args = new Dictionary<string, object> { ["max"] = ApiKeyFields.MaxNameLength } };
        }
        return trimmed;
    }

    /// <summary>
    /// Validates every requested pair against <see cref="ApiKeyScopes.IsValid"/> and de-duplicates
    /// exact repeats, since a client re-sending the same pair twice should not fail on that alone.
    /// <seealso>ApiKeyServiceTests.CreateAsync_RejectsAnInvalidScopePair</seealso>
    /// <seealso>ApiKeyServiceTests.CreateAsync_RejectsAnEmptyScopeList</seealso>
    /// </summary>
    private static List<ApiKeyScopeDto> NormalizeScopes(List<ApiKeyScopeDto>? scopes)
    {
        if (scopes is null || scopes.Count == 0)
        {
            throw new ValidationException("At least one scope is required.") { Code = ErrorCodes.ApiKeyScopesRequired };
        }

        var normalized = new List<ApiKeyScopeDto>();
        var seen = new HashSet<(string, string)>();
        foreach (ApiKeyScopeDto scope in scopes)
        {
            if (!ApiKeyScopes.IsValid(scope.Resource, scope.Access))
            {
                throw new ValidationException(
                    $"'{scope.Resource}:{scope.Access}' is not a valid scope.")
                { Code = ErrorCodes.ApiKeyScopeInvalid };
            }
            if (seen.Add((scope.Resource, scope.Access)))
            {
                normalized.Add(new ApiKeyScopeDto { Resource = scope.Resource, Access = scope.Access });
            }
        }
        return normalized;
    }

    private DateTime? NormalizeExpiresAt(DateTime? expiresAt)
    {
        if (expiresAt is null) return null;

        DateTime utc = expiresAt.Value.Kind == DateTimeKind.Utc ? expiresAt.Value : expiresAt.Value.ToUniversalTime();
        if (utc <= _clock.UtcNow)
        {
            throw new ValidationException("Expiry must be in the future.") { Code = ErrorCodes.ApiKeyExpiresAtInPast };
        }
        return utc;
    }
}
