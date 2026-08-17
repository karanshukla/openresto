using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class AuditQueryServiceTests
{
    private readonly Mock<IAdminAuditRepository> _repository = new();

    private AuditQueryService CreateService() => new(_repository.Object);

    private void Returns(params AdminAuditEntry[] entries)
        => _repository
            .Setup(r => r.QueryPagedAsync(It.IsAny<AuditQuery>(), It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync((entries.ToList(), entries.Length));

    private static AdminAuditEntry Entry(string? changesJson = null) => new()
    {
        Id = 1,
        OccurredAt = new DateTime(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc),
        ActorUserId = 3,
        ActorEmail = "owner@test.com",
        ActorDisplayName = "Sam Owner",
        ActorRole = UserRoles.Owner,
        Action = AuditActions.BookingCancel,
        TargetType = AuditTargets.Booking,
        TargetId = "42",
        TargetLabel = "ABC123",
        RestaurantId = 5,
        Summary = "Cancelled booking ABC123",
        ChangesJson = changesJson,
        HttpMethod = "POST",
        Path = "/api/admin/bookings/42/cancel",
        StatusCode = 204,
        IpAddress = "203.0.113.4",
        UserAgent = "Mozilla/5.0",
    };

    [Fact]
    public async Task GetEntriesAsync_MapsEveryFieldOntoTheDto()
    {
        Returns(Entry());

        (List<AdminAuditEntryDto> items, int total) = await CreateService().GetEntriesAsync(new AuditQuery(), 1, 25);

        AdminAuditEntryDto dto = Assert.Single(items);
        Assert.Equal(1, total);
        Assert.Equal("owner@test.com", dto.ActorEmail);
        Assert.Equal("Sam Owner", dto.ActorDisplayName);
        Assert.Equal(AuditActions.BookingCancel, dto.Action);
        Assert.Equal("ABC123", dto.TargetLabel);
        Assert.Equal(5, dto.RestaurantId);
        Assert.Equal(204, dto.StatusCode);
        Assert.Equal("203.0.113.4", dto.IpAddress);
        Assert.Empty(dto.Changes);
    }

    [Fact]
    public async Task GetEntriesAsync_UnpacksTheStoredDiff_SoTheClientNeverParsesAStringField()
    {
        var scope = new AuditScope();
        scope.RecordChange("seats", 2, 4);
        Returns(Entry(scope.ChangesJson()));

        (List<AdminAuditEntryDto> items, _) = await CreateService().GetEntriesAsync(new AuditQuery(), 1, 25);

        AuditChangeDto change = Assert.Single(items[0].Changes);
        Assert.Equal("seats", change.Field);
        Assert.Equal("2", change.Before);
        Assert.Equal("4", change.After);
    }

    /// <summary>
    /// The diff is the enrichment, not the record. A row whose JSON cannot be read still has to
    /// render — dropping it would lose the actor and the action too.
    /// </summary>
    [Fact]
    public async Task GetEntriesAsync_StillReturnsTheEntry_WhenItsStoredDiffIsUnreadable()
    {
        Returns(Entry("{not json"));

        (List<AdminAuditEntryDto> items, _) = await CreateService().GetEntriesAsync(new AuditQuery(), 1, 25);

        Assert.Single(items);
        Assert.Empty(items[0].Changes);
    }

    [Fact]
    public async Task GetEntriesAsync_TreatsNullJsonAsNoChanges()
    {
        Returns(Entry("null"));

        (List<AdminAuditEntryDto> items, _) = await CreateService().GetEntriesAsync(new AuditQuery(), 1, 25);

        Assert.Empty(items[0].Changes);
    }

    [Theory]
    [InlineData(0, AuditQueryService.MinPageSize)]
    [InlineData(1000, AuditQueryService.MaxPageSize)]
    [InlineData(25, 25)]
    public async Task GetEntriesAsync_ClampsPageSizeToTheSameBoundsAsNotificationHistory(int requested, int expected)
    {
        Returns();

        await CreateService().GetEntriesAsync(new AuditQuery(), 1, requested);

        _repository.Verify(r => r.QueryPagedAsync(It.IsAny<AuditQuery>(), It.IsAny<int>(), expected), Times.Once);
    }

    [Fact]
    public async Task GetEntriesAsync_FloorsPageAtOne()
    {
        Returns();

        await CreateService().GetEntriesAsync(new AuditQuery(), 0, 25);

        _repository.Verify(r => r.QueryPagedAsync(It.IsAny<AuditQuery>(), 1, It.IsAny<int>()), Times.Once);
    }
}
