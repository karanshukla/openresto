using System.Text.Json;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Services;

public class AuditScopeTests
{
    private static Dictionary<string, AuditChange> Parse(string json)
        => JsonSerializer.Deserialize<Dictionary<string, AuditChange>>(json, AuditChange.JsonOptions)!;

    [Fact]
    public void IsDescribed_IsFalseUntilAServiceNamesTheAction()
    {
        var scope = new AuditScope();

        Assert.False(scope.IsDescribed);

        scope.Describe(AuditActions.BookingCancel);

        Assert.True(scope.IsDescribed);
    }

    [Fact]
    public void Describe_LetsALaterCallRefineAnEarlierOne_WithoutClearingWhatItOmits()
    {
        var scope = new AuditScope();

        scope.Describe(AuditActions.BookingUpdate, targetType: AuditTargets.Booking, targetId: "42", restaurantId: 7);
        scope.Describe(AuditActions.BookingCancel, summary: "Cancelled booking ABC123");

        Assert.Equal(AuditActions.BookingCancel, scope.Action);
        Assert.Equal(AuditTargets.Booking, scope.TargetType);
        Assert.Equal("42", scope.TargetId);
        Assert.Equal(7, scope.RestaurantId);
        Assert.Equal("Cancelled booking ABC123", scope.Summary);
    }

    [Fact]
    public void RecordChange_DropsFieldsThatDidNotChange()
    {
        var scope = new AuditScope();

        scope.RecordChange("seats", 4, 4);

        Assert.Null(scope.ChangesJson());
    }

    [Fact]
    public void RecordChange_StoresBeforeAndAfterForOrdinaryFields()
    {
        var scope = new AuditScope();

        scope.RecordChange("seats", 2, 4);

        Dictionary<string, AuditChange> changes = Parse(scope.ChangesJson()!);
        Assert.Equal("2", changes["seats"].Before);
        Assert.Equal("4", changes["seats"].After);
    }

    /// <summary>
    /// The entry has to be able to say a password changed without saying what to. Comparing the
    /// raw values before masking is what keeps that possible — mask first and both sides read
    /// "[redacted]", the change looks like a no-op, and the record disappears.
    /// </summary>
    [Fact]
    public void RecordChange_RecordsThatAProtectedFieldChanged_ButNotItsValues()
    {
        var scope = new AuditScope();

        scope.RecordChange("password", "old-secret", "new-secret");

        Dictionary<string, AuditChange> changes = Parse(scope.ChangesJson()!);
        Assert.Equal(AuditFields.RedactedMarker, changes["password"].Before);
        Assert.Equal(AuditFields.RedactedMarker, changes["password"].After);
    }

    [Fact]
    public void RecordChange_LastWriteWinsForTheSameField()
    {
        var scope = new AuditScope();

        scope.RecordChange("name", "A", "B");
        scope.RecordChange("name", "A", "C");

        Dictionary<string, AuditChange> changes = Parse(scope.ChangesJson()!);
        Assert.Single(changes);
        Assert.Equal("C", changes["name"].After);
    }

    /// <summary>
    /// Half a JSON document is worse than none: the read side would fail to parse it and the
    /// whole diff would be lost anyway, so an over-long payload is dropped as a unit.
    /// </summary>
    [Fact]
    public void ChangesJson_IsDroppedRatherThanClippedWhenItExceedsTheColumn()
    {
        var scope = new AuditScope();
        scope.RecordChange("notes", "", new string('x', AuditFields.MaxChangesJsonLength + 1));

        Assert.Null(scope.ChangesJson());
    }

    [Fact]
    public void ChangesJson_IsKeptWhenItFitsTheColumn()
    {
        var scope = new AuditScope();
        scope.RecordChange("notes", "", new string('x', 100));

        Assert.NotNull(scope.ChangesJson());
    }

    [Fact]
    public void AttributeTo_OverridesTheRequestClaims()
    {
        var scope = new AuditScope();

        Assert.False(scope.HasExplicitActor);

        scope.AttributeTo(9, "owner@example.com", "Sam Owner", UserRoles.Owner);

        Assert.True(scope.HasExplicitActor);
        Assert.Equal(9, scope.ActorUserId);
        Assert.Equal("owner@example.com", scope.ActorEmail);
        Assert.Equal("Sam Owner", scope.ActorDisplayName);
        Assert.Equal(UserRoles.Owner, scope.ActorRole);
    }

    /// <summary>
    /// A failed login has no account to point at, so the id stays null while the attempted
    /// address is still recorded — that address is the whole value of the entry.
    /// </summary>
    [Fact]
    public void AttributeTo_AcceptsAnActorWithNoAccount()
    {
        var scope = new AuditScope();

        scope.AttributeTo(null, "nobody@example.com", role: string.Empty);

        Assert.True(scope.HasExplicitActor);
        Assert.Null(scope.ActorUserId);
        Assert.Equal("nobody@example.com", scope.ActorEmail);
    }

    [Fact]
    public void NullAuditScope_AcceptsEveryCallAndRecordsNothing()
    {
        IAuditScope scope = NullAuditScope.Instance;

        scope.Describe(AuditActions.BookingCancel, targetId: "1");
        scope.RecordChange("seats", 2, 4);
        scope.AttributeTo(1, "a@b.com");

        Assert.Same(NullAuditScope.Instance, scope);
    }
}
