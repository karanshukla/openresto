using Microsoft.Extensions.Options;
using Moq;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Settings;

namespace OpenRestoApi.Tests.Services;

public class AuditRetentionServiceTests
{
    private static readonly DateTime Now = new(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc);

    private sealed class FixedClock : ISystemClock
    {
        public DateTime UtcNow => Now;
    }

    private readonly Mock<IAdminAuditRepository> _repository = new();

    private AuditRetentionService CreateService(int retentionDays)
        => new(_repository.Object, new FixedClock(),
            Options.Create(new AuditSettings { RetentionDays = retentionDays }));

    [Fact]
    public async Task PruneAsync_DeletesEntriesOlderThanRetentionWindow()
    {
        _repository.Setup(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>())).ReturnsAsync(7);

        int removed = await CreateService(AuditSettings.DefaultRetentionDays).PruneAsync();

        Assert.Equal(7, removed);
        _repository.Verify(r => r.DeleteOlderThanAsync(Now.AddDays(-AuditSettings.DefaultRetentionDays)), Times.Once);
    }

    /// <summary>
    /// The cutoff is the boundary the operator configured, so a one-day window must not reach
    /// back two — the pair of tests is what stops an off-by-one turning retention into deletion.
    /// </summary>
    [Fact]
    public async Task PruneAsync_KeepsEntriesInsideRetentionWindow()
    {
        _repository.Setup(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>())).ReturnsAsync(0);

        await CreateService(1).PruneAsync();

        _repository.Verify(r => r.DeleteOlderThanAsync(Now.AddDays(-1)), Times.Once);
        _repository.Verify(r => r.DeleteOlderThanAsync(It.Is<DateTime>(d => d < Now.AddDays(-1))), Times.Never);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task PruneAsync_DeletesNothing_WhenRetentionDisabled(int retentionDays)
    {
        int removed = await CreateService(retentionDays).PruneAsync();

        Assert.Equal(0, removed);
        _repository.Verify(r => r.DeleteOlderThanAsync(It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public void DefaultSettings_KeepAYearOfHistory()
    {
        var settings = new AuditSettings();

        Assert.Equal(365, settings.RetentionDays);
        Assert.True(settings.IsRetentionEnabled);
    }
}
