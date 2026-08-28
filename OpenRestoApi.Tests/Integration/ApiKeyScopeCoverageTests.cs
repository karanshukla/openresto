using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using OpenRestoApi.Infrastructure.Auditing;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// The structural guarantee behind issue #319 Phase 2: every controller action gated by
/// <c>AuthPolicies.RequireAdmin</c>/<c>RequireOwner</c> must carry exactly one of
/// <see cref="RequiresScopeAttribute"/> or <see cref="NoApiKeyAccessAttribute"/> — on the action
/// itself or its controller. Modeled on <c>AuditCoverageTests</c>: the floor is structural rather
/// than a maintained list, so an admin endpoint added next year is scoped (or explicitly excluded)
/// the day it ships, instead of silently inheriting whatever an API key can already do.
/// </summary>
public class ApiKeyScopeCoverageTests
{
    private sealed record ActionInfo(string Controller, string Method, string HttpMethod)
    {
        public override string ToString() => $"{HttpMethod} {Controller}.{Method}";
    }

    private static List<IAuthorizeData> AuthorizeDataFor(Type controller, MethodInfo method)
        => [.. controller.GetCustomAttributes().OfType<IAuthorizeData>()
            .Concat(method.GetCustomAttributes().OfType<IAuthorizeData>())];

    private static IEnumerable<(ActionInfo Info, MethodInfo Method, Type Controller)> AdminGatedActions()
    {
        IEnumerable<Type> controllers = typeof(OpenRestoApi.Controllers.AdminController).Assembly
            .GetTypes()
            .Where(t => t is { IsAbstract: false } && typeof(ControllerBase).IsAssignableFrom(t));

        foreach (Type controller in controllers)
        {
            foreach (MethodInfo method in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                List<IActionHttpMethodProvider> verbs = [.. method.GetCustomAttributes().OfType<IActionHttpMethodProvider>()];
                if (verbs.Count == 0) continue;

                if (!AuditRequestClassifier.RequiresAdminPolicy(AuthorizeDataFor(controller, method))) continue;

                yield return (new ActionInfo(controller.Name, method.Name, verbs[0].HttpMethods.First()), method, controller);
            }
        }
    }

    private static bool HasRequiresScope(Type controller, MethodInfo method)
        => controller.GetCustomAttributes<RequiresScopeAttribute>().Any()
            || method.GetCustomAttributes<RequiresScopeAttribute>().Any();

    private static bool HasNoApiKeyAccess(Type controller, MethodInfo method)
        => controller.GetCustomAttribute<NoApiKeyAccessAttribute>() is not null
            || method.GetCustomAttribute<NoApiKeyAccessAttribute>() is not null;

    /// <summary>
    /// The hole this whole test exists to close: an admin-gated action with neither attribute is
    /// reachable by any API key regardless of scope — <see cref="RequiresScopeAttribute"/> and
    /// <see cref="NoApiKeyAccessAttribute"/> are both no-ops for a request that never authenticated
    /// as a key in the first place, so a JWT session is unaffected either way, but a key would
    /// simply pass straight through.
    /// </summary>
    [Fact]
    public void EveryAdminGatedAction_CarriesRequiresScopeOrNoApiKeyAccess()
    {
        List<ActionInfo> unscoped = [.. AdminGatedActions()
            .Where(a => !HasRequiresScope(a.Controller, a.Method) && !HasNoApiKeyAccess(a.Controller, a.Method))
            .Select(a => a.Info)];

        Assert.True(unscoped.Count == 0,
            "These admin-gated actions carry neither [RequiresScope] nor [NoApiKeyAccess] (on "
            + "themselves or their controller), so any API key can reach them regardless of its "
            + "scopes:\n  " + string.Join("\n  ", unscoped));
    }

    /// <summary>
    /// The complementary mistake: an action can't simultaneously declare a scope requirement and a
    /// blanket key ban — <see cref="NoApiKeyAccessAttribute"/> would make the scope check
    /// unreachable dead code, and it signals the mapping was applied without deciding which rule
    /// actually governs the endpoint.
    /// </summary>
    [Fact]
    public void NoAdminGatedAction_CarriesBothRequiresScopeAndNoApiKeyAccess()
    {
        List<ActionInfo> conflicting = [.. AdminGatedActions()
            .Where(a => HasRequiresScope(a.Controller, a.Method) && HasNoApiKeyAccess(a.Controller, a.Method))
            .Select(a => a.Info)];

        Assert.True(conflicting.Count == 0,
            "These admin-gated actions carry both [RequiresScope] and [NoApiKeyAccess] — pick one "
            + "rule for the endpoint:\n  " + string.Join("\n  ", conflicting));
    }
}
