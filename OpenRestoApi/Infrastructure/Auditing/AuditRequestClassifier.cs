using Microsoft.AspNetCore.Authorization;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Infrastructure.Auditing;

/// <summary>
/// Decides which requests the audit floor covers: any non-read call to an endpoint gated by an
/// admin policy, made by someone who got past that gate. Because the rule is structural rather
/// than a list of endpoints, an action added tomorrow is audited the day it ships.
/// <para>
/// The two halves are exposed separately so a test can reflect over every controller action and
/// assert the same predicate the middleware uses.
/// </para>
/// <seealso>AuditCoverageTests.EveryAuthorizedMutatingAction_IsGatedByANamedAdminPolicy</seealso>
/// <seealso>AuditCoverageTests.EveryMutatingAdminEndpoint_IsGatedOrAnAuthenticationPath</seealso>
/// </summary>
public static class AuditRequestClassifier
{
    private static readonly HashSet<string> ReadOnlyMethods =
        new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS", "TRACE" };

    private static readonly HashSet<string> AdminPolicies =
        new(StringComparer.Ordinal) { AuthPolicies.RequireAdmin, AuthPolicies.RequireOwner };

    /// <summary>Reads are out of scope: every dashboard poll would otherwise be a row.</summary>
    public static bool IsMutatingMethod(string? method)
        => !string.IsNullOrEmpty(method) && !ReadOnlyMethods.Contains(method);

    public static bool RequiresAdminPolicy(IEnumerable<IAuthorizeData> authorizeData)
        => authorizeData.Any(a => a.Policy is not null && AdminPolicies.Contains(a.Policy));

    /// <summary>
    /// True when this request must land a row regardless of what any service said about it.
    /// Evaluated after the pipeline has run, so the endpoint and the authenticated principal are
    /// both resolved.
    /// </summary>
    public static bool IsAuditableAdminRequest(HttpContext context)
    {
        if (!IsMutatingMethod(context.Request.Method)) return false;
        if (context.User?.Identity?.IsAuthenticated != true) return false;

        Endpoint? endpoint = context.GetEndpoint();
        if (endpoint is null) return false;

        return RequiresAdminPolicy(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>());
    }
}
