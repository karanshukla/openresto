using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auditing;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// What stops the audit log quietly rotting as endpoints get added. The floor is structural —
/// the middleware audits any mutating request to an endpoint gated by an admin policy — so the
/// only way to ship an unaudited admin action is to gate it some other way, or not at all. Both
/// are asserted here, over every controller action in the assembly, so a new endpoint that slips
/// through fails a test rather than going unnoticed until someone needs the trail.
/// </summary>
public class AuditCoverageTests
{
    private sealed record ActionInfo(string Controller, string Method, string HttpMethod, string Route)
    {
        public override string ToString() => $"{HttpMethod} {Route} ({Controller}.{Method})";
    }

    /// <summary>
    /// The mutating endpoints that are deliberately reachable without a session, and are audited
    /// by explicit service-level description instead of by the policy-driven floor. Everything
    /// here is an authentication path: you cannot require a token to obtain a token.
    /// </summary>
    private static readonly HashSet<string> UnauthenticatedByDesign =
    [
        "AuthController.Login",
        "AuthController.Logout",
        "AuthController.VerifyPvq",
        "AuthController.ResetPassword",
    ];

    private static IEnumerable<(ActionInfo Info, MethodInfo Method, Type Controller)> MutatingActions()
    {
        IEnumerable<Type> controllers = typeof(OpenRestoApi.Controllers.AdminController).Assembly
            .GetTypes()
            .Where(t => t is { IsAbstract: false } && typeof(ControllerBase).IsAssignableFrom(t));

        foreach (Type controller in controllers)
        {
            foreach (MethodInfo method in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                foreach (IActionHttpMethodProvider verb in method.GetCustomAttributes().OfType<IActionHttpMethodProvider>())
                {
                    string httpMethod = verb.HttpMethods.First();
                    if (!AuditRequestClassifier.IsMutatingMethod(httpMethod)) continue;

                    yield return (
                        new ActionInfo(controller.Name, method.Name, httpMethod, RouteOf(controller, verb)),
                        method,
                        controller);
                }
            }
        }
    }

    private static string RouteOf(Type controller, IActionHttpMethodProvider verb)
    {
        string prefix = controller.GetCustomAttribute<RouteAttribute>()?.Template ?? string.Empty;
        prefix = prefix.Replace("[controller]", controller.Name.Replace("Controller", string.Empty), StringComparison.Ordinal);
        string suffix = (verb as IRouteTemplateProvider)?.Template ?? string.Empty;
        return string.IsNullOrEmpty(suffix) ? $"/{prefix}" : $"/{prefix}/{suffix}";
    }

    private static List<IAuthorizeData> AuthorizeDataFor(Type controller, MethodInfo method)
        => [.. controller.GetCustomAttributes().OfType<IAuthorizeData>()
            .Concat(method.GetCustomAttributes().OfType<IAuthorizeData>())];

    /// <summary>
    /// A gate that names no policy — a bare <c>[Authorize]</c>, or one listing raw roles — passes
    /// authorization but is invisible to the audit floor, so the action would run unrecorded.
    /// </summary>
    [Fact]
    public void EveryAuthorizedMutatingAction_IsGatedByANamedAdminPolicy()
    {
        List<ActionInfo> unclassifiable = MutatingActions()
            .Where(a => AuthorizeDataFor(a.Controller, a.Method).Count > 0)
            .Where(a => !AuditRequestClassifier.RequiresAdminPolicy(AuthorizeDataFor(a.Controller, a.Method)))
            .Select(a => a.Info)
            .ToList();

        Assert.True(unclassifiable.Count == 0,
            "These mutating actions are authorized by something other than AuthPolicies.RequireAdmin/RequireOwner, "
            + "so AuditRequestClassifier cannot see them and they would go unaudited:\n  "
            + string.Join("\n  ", unclassifiable));
    }

    /// <summary>
    /// The complementary hole: an admin endpoint shipped with no gate at all is both a security
    /// bug and an audit bug, and the audit floor would miss it for the same reason authorization does.
    /// </summary>
    [Fact]
    public void EveryMutatingAdminEndpoint_IsGatedOrAnAuthenticationPath()
    {
        List<ActionInfo> ungated = MutatingActions()
            .Where(a => a.Info.Route.Contains("/api/admin", StringComparison.OrdinalIgnoreCase))
            .Where(a => !AuditRequestClassifier.RequiresAdminPolicy(AuthorizeDataFor(a.Controller, a.Method)))
            .Where(a => !UnauthenticatedByDesign.Contains($"{a.Info.Controller}.{a.Info.Method}"))
            .Select(a => a.Info)
            .ToList();

        Assert.True(ungated.Count == 0,
            "These mutating /api/admin endpoints are neither policy-gated nor listed as an authentication "
            + "path, so nothing records who called them:\n  " + string.Join("\n  ", ungated));
    }

    /// <summary>
    /// Keeps the exemption list honest: an entry that no longer matches a real action is a stale
    /// waiver that would silently excuse a future method of the same name.
    /// </summary>
    [Fact]
    public void EveryDocumentedExemption_StillNamesARealUnauthenticatedAction()
    {
        HashSet<string> actual = MutatingActions()
            .Where(a => AuthorizeDataFor(a.Controller, a.Method).Count == 0)
            .Select(a => $"{a.Info.Controller}.{a.Info.Method}")
            .ToHashSet();

        List<string> stale = UnauthenticatedByDesign.Where(e => !actual.Contains(e)).ToList();

        Assert.True(stale.Count == 0, "Stale audit exemptions: " + string.Join(", ", stale));
    }

    [Fact]
    public void TheAuditTrailItselfIsOwnerOnlyAndReadOnly()
    {
        Type controller = typeof(OpenRestoApi.Controllers.AuditController);

        Assert.Equal(
            AuthPolicies.RequireOwner,
            controller.GetCustomAttributes().OfType<IAuthorizeData>().Single().Policy);

        // An admin who can erase the audit log has no audit log: entries leave only through the
        // retention pass, never through a request.
        Assert.DoesNotContain(MutatingActions(), a => a.Controller == controller);
    }
}
