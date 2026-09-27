using Microsoft.AspNetCore.Mvc.Filters;

namespace OpenRestoApi.Infrastructure.Auth;

/// <summary>
/// Marks an admin-gated action as reachable by any authenticated API key regardless of scope —
/// for self-introspection (<c>ApiKeysController.Self</c>, issue #319 Phase 2) where a key is
/// identifying itself, not exercising a scoped capability against a resource. Structurally a
/// no-op: an <c>[Authorize(Policy = ...)]</c> action with neither <see cref="RequiresScopeAttribute"/>
/// nor <see cref="NoApiKeyAccessAttribute"/> already lets a key straight through, so this carries
/// no runtime check of its own. It exists purely as the third value <c>ApiKeyScopeCoverageTests</c>
/// reflects for, so "reachable by any key on purpose" reads differently from "nobody decided yet".
/// <seealso>ApiKeyScopeCoverageTests.EveryAdminGatedAction_CarriesExactlyOneAccessMarker</seealso>
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AllowAnyApiKeyAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        // No-op: the absence of NoApiKeyAccess/RequiresScope is already sufficient for a key to
        // pass. This attribute only marks the decision for ApiKeyScopeCoverageTests to find.
    }
}
