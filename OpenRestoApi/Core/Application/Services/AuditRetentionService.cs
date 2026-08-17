using Microsoft.Extensions.Options;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Settings;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Drops audit entries past their retention window. Split out of the hosted service that calls
/// it so the rule — what the cutoff is, and that a disabled setting deletes nothing — is
/// testable without a running host.
/// <seealso>AuditRetentionServiceTests.PruneAsync_DeletesEntriesOlderThanRetentionWindow</seealso>
/// <seealso>AuditRetentionServiceTests.PruneAsync_KeepsEntriesInsideRetentionWindow</seealso>
/// <seealso>AuditRetentionServiceTests.PruneAsync_DeletesNothing_WhenRetentionDisabled</seealso>
/// </summary>
public class AuditRetentionService(
    IAdminAuditRepository repository,
    ISystemClock clock,
    IOptions<AuditSettings> settings)
{
    private readonly IAdminAuditRepository _repository = repository;
    private readonly ISystemClock _clock = clock;
    private readonly AuditSettings _settings = settings.Value;

    /// <summary>Returns how many entries were removed.</summary>
    public async Task<int> PruneAsync()
    {
        if (!_settings.IsRetentionEnabled) return 0;

        DateTime cutoff = _clock.UtcNow.AddDays(-_settings.RetentionDays);
        return await _repository.DeleteOlderThanAsync(cutoff);
    }
}
