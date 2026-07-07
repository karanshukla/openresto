using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingConfirmationServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.EmailSettingsServiceTests")]
[ExternalAccessAllowed]
internal class EmailFailureRepository(AppDbContext db) : IEmailFailureRepository
{
    private readonly AppDbContext _db = db;

    public async Task AddAsync(EmailFailure failure)
    {
        _db.EmailFailures.Add(failure);
        await _db.SaveChangesAsync();
    }

    public async Task<List<EmailFailure>> GetRecentAsync(int count = 50)
    {
        return await _db.EmailFailures
            .OrderByDescending(f => f.AttemptedAt)
            .Take(count)
            .ToListAsync();
    }
}
