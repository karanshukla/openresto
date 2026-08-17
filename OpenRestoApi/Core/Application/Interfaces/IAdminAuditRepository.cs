using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Append, read and prune. There is deliberately no update and no single-row delete: the only
/// path that removes an entry is the retention pass, which drops whole date ranges.
/// </summary>
public interface IAdminAuditRepository
{
    Task AddAsync(AdminAuditEntry entry);

    Task<(List<AdminAuditEntry> Items, int TotalCount)> QueryPagedAsync(AuditQuery query, int page, int pageSize);

    /// <summary>Returns how many rows were dropped, for the retention pass to log.</summary>
    Task<int> DeleteOlderThanAsync(DateTime cutoffUtc);
}
