using CustomAccessibility.Attributes;
using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence.Repositories;

[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BrandServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.MediaServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingServiceTests")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.BookingConfirmationServiceTests")]
[ExternalAccessAllowed]
internal class BrandSettingsRepository(AppDbContext db) : IBrandSettingsRepository
{
    private readonly AppDbContext _db = db;

    public async Task<BrandSettings?> GetAsync()
    {
        return await _db.Set<BrandSettings>().FirstOrDefaultAsync();
    }

    public async Task<BrandSettings> AddAsync(BrandSettings brand)
    {
        _db.Set<BrandSettings>().Add(brand);
        await _db.SaveChangesAsync();
        return brand;
    }

    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
