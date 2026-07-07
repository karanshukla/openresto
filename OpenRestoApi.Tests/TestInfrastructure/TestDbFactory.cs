using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.TestInfrastructure;

/// <summary>
/// Creates a fresh EF in-memory DbContext with a unique name per test to avoid
/// cross-test state leakage. The standard pattern across service tests.
/// </summary>
internal static class TestDbFactory
{
    public static AppDbContext Create(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }
}
