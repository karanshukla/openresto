using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.AuthServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.SecurityQuestionsServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.UserServiceTests")]
[ExternalAccessAllowed]
internal class AdminCredentialRepository(AppDbContext db) : IAdminCredentialRepository
{
    private readonly AppDbContext _db = db;

    public async Task<AdminCredential?> GetByIdAsync(int id)
    {
        return await _db.AdminCredentials.FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<AdminCredential>> GetAllAsync()
    {
        return await _db.AdminCredentials.OrderBy(c => c.Id).ToListAsync();
    }

    public async Task<int> CountActiveByRoleAsync(string role)
    {
        return await _db.AdminCredentials.CountAsync(c => c.IsActive && c.Role == role);
    }

    public async Task<AdminCredential?> GetByEmailAsync(string email)
    {
        string normalized = email.Trim().ToLowerInvariant();
#pragma warning disable CA1862, CA1311, CA1304 // ToLower in LINQ-to-EF is intentional (ToLowerInvariant is not translatable)
        return await _db.AdminCredentials.FirstOrDefaultAsync(c => c.Email.ToLower() == normalized);
#pragma warning restore CA1862, CA1311, CA1304
    }

    public async Task<AdminCredential?> GetByResetTokenAsync(string resetToken)
    {
        return await _db.AdminCredentials.FirstOrDefaultAsync(c => c.ResetToken == resetToken);
    }

    public async Task<AdminCredential> AddAsync(AdminCredential credential)
    {
        _db.AdminCredentials.Add(credential);
        await _db.SaveChangesAsync();
        return credential;
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
