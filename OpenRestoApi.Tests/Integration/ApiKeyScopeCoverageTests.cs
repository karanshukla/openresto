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
/// <see cref="RequiresScopeAttribute"/>, <see cref="NoApiKeyAccessAttribute"/>, or
/// <see cref="AllowAnyApiKeyAttribute"/> — on the action itself or its controller. Modeled on
/// <c>AuditCoverageTests</c>: the floor is structural rather than a maintained list, so an admin
/// endpoint added next year is scoped (or explicitly excluded, or explicitly opened to any key)
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

    private static bool HasAllowAnyApiKey(Type controller, MethodInfo method)
        => controller.GetCustomAttribute<AllowAnyApiKeyAttribute>() is not null
            || method.GetCustomAttribute<AllowAnyApiKeyAttribute>() is not null;

    private static int MarkerCount(Type controller, MethodInfo method)
        => (HasRequiresScope(controller, method) ? 1 : 0)
            + (HasNoApiKeyAccess(controller, method) ? 1 : 0)
            + (HasAllowAnyApiKey(controller, method) ? 1 : 0);

    /// <summary>
    /// The hole this whole test exists to close: an admin-gated action with none of the three
    /// markers is reachable by any API key regardless of scope — all three are no-ops for a
    /// request that never authenticated as a key in the first place, so a JWT session is
    /// unaffected either way, but a key would simply pass straight through.
    /// </summary>
    [Fact]
    public void EveryAdminGatedAction_CarriesExactlyOneAccessMarker()
    {
        List<ActionInfo> unmarked = [.. AdminGatedActions()
            .Where(a => MarkerCount(a.Controller, a.Method) == 0)
            .Select(a => a.Info)];

        Assert.True(unmarked.Count == 0,
            "These admin-gated actions carry none of [RequiresScope], [NoApiKeyAccess], or "
            + "[AllowAnyApiKey] (on themselves or their controller), so any API key can reach "
            + "them regardless of its scopes:\n  " + string.Join("\n  ", unmarked));
    }

    /// <summary>
    /// The complementary mistake: an action can't simultaneously declare two of the three markers
    /// — each would make another's check unreachable dead code, and it signals the mapping was
    /// applied without deciding which single rule actually governs the endpoint.
    /// </summary>
    [Fact]
    public void NoAdminGatedAction_CarriesMoreThanOneAccessMarker()
    {
        List<ActionInfo> conflicting = [.. AdminGatedActions()
            .Where(a => MarkerCount(a.Controller, a.Method) > 1)
            .Select(a => a.Info)];

        Assert.True(conflicting.Count == 0,
            "These admin-gated actions carry more than one of [RequiresScope], [NoApiKeyAccess], "
            + "[AllowAnyApiKey] — pick one rule for the endpoint:\n  " + string.Join("\n  ", conflicting));
    }
}
