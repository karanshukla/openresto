using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AuditQueryServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AuditRetentionServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Infrastructure.AdminAuditRepositoryTests")]
[ExternalAccessAllowed]
internal class AdminAuditRepository(AppDbContext db) : IAdminAuditRepository
{
    private readonly AppDbContext _db = db;

    public async Task AddAsync(AdminAuditEntry entry)
    {
        _db.AdminAuditEntries.Add(entry);
        await _db.SaveChangesAsync();
    }

    public async Task<(List<AdminAuditEntry> Items, int TotalCount)> QueryPagedAsync(
        AuditQuery query, int page, int pageSize)
    {
        IQueryable<AdminAuditEntry> q = _db.AdminAuditEntries.AsNoTracking();

        if (query.ActorUserId.HasValue)
            q = q.Where(e => e.ActorUserId == query.ActorUserId.Value);

        // Prefix rather than equality, so "booking" selects every booking.* key and
        // "booking.cancel" still selects exactly one.
        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            string prefix = query.Action.Trim();
            q = q.Where(e => e.Action.StartsWith(prefix));
        }

        if (!string.IsNullOrWhiteSpace(query.TargetType))
            q = q.Where(e => e.TargetType == query.TargetType);

        if (query.RestaurantId.HasValue)
            q = q.Where(e => e.RestaurantId == query.RestaurantId.Value);

        if (query.From.HasValue)
            q = q.Where(e => e.OccurredAt >= query.From.Value);

        if (query.To.HasValue)
            q = q.Where(e => e.OccurredAt <= query.To.Value);

        // Id breaks ties: entries written inside the same clock tick would otherwise page
        // non-deterministically and drop or repeat rows across page boundaries.
        q = q.OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id);

        int total = await q.CountAsync();
        List<AdminAuditEntry> items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoffUtc)
        => await _db.AdminAuditEntries.Where(e => e.OccurredAt < cutoffUtc).ExecuteDeleteAsync();
}
