using Microsoft.AspNetCore.Authorization;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auditing;

namespace OpenRestoApi.Tests.Infrastructure;

public class AuditRequestClassifierTests
{
    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    [InlineData("post")]
    public void IsMutatingMethod_IsTrueForWrites(string method)
        => Assert.True(AuditRequestClassifier.IsMutatingMethod(method));

    /// <summary>
    /// Reads are out of scope for v1: every dashboard poll would otherwise be a row, and the
    /// volume would bury the writes the log exists to show.
    /// </summary>
    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    [InlineData("TRACE")]
    [InlineData("")]
    [InlineData(null)]
    public void IsMutatingMethod_IsFalseForReads(string? method)
        => Assert.False(AuditRequestClassifier.IsMutatingMethod(method));

    [Theory]
    [InlineData(AuthPolicies.RequireAdmin)]
    [InlineData(AuthPolicies.RequireOwner)]
    public void RequiresAdminPolicy_RecognisesBothAdminPolicies(string policy)
        => Assert.True(AuditRequestClassifier.RequiresAdminPolicy([new AuthorizeAttribute { Policy = policy }]));

    /// <summary>
    /// A gate that does not name one of the two policies is invisible to the audit floor. The
    /// coverage test asserts no controller ships one; this pins what the classifier does when it
    /// meets one.
    /// </summary>
    [Fact]
    public void RequiresAdminPolicy_RejectsAGateThatNamesNoPolicy()
    {
        Assert.False(AuditRequestClassifier.RequiresAdminPolicy([new AuthorizeAttribute()]));
        Assert.False(AuditRequestClassifier.RequiresAdminPolicy([new AuthorizeAttribute { Roles = UserRoles.Owner }]));
        Assert.False(AuditRequestClassifier.RequiresAdminPolicy([]));
    }
}
