using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Infrastructure.Auth;

/// <summary>
/// Declares that an action needs a given <c>{resource, access}</c> scope (see
/// <see cref="ApiKeyScopes"/>) when the caller is authenticated via an admin API key. A JWT or
/// browser-cookie session carries no scope claims at all and is deliberately unaffected — scoping
/// exists to narrow what a headless credential can do, not to add a second permission system on
/// top of roles for a human signed into the admin UI.
/// <para>
/// Phase 1 applies this only to <c>ApiKeysController</c> (which also carries
/// <see cref="NoApiKeyAccessAttribute"/>, so it never actually fires there). Blanket application
/// across every controller, reflection-checked the way <c>AuditCoverageTests</c> checks policy
/// gating, is the next phase.
/// </para>
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequiresScopeAttribute(string resource, string access) : Attribute, IAuthorizationFilter
{
    public string Resource { get; } = resource;
    public string Access { get; } = access;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (!context.HttpContext.User.IsApiKeyAuthenticated())
        {
            return;
        }

        if (!context.HttpContext.User.HasScope(Resource, Access))
        {
            context.Result = new ObjectResult(new MessageResponse
            {
                Message = $"This API key is missing the '{Resource}:{Access}' scope.",
                Code = ErrorCodes.ApiKeyScopeMissing,
            })
            { StatusCode = StatusCodes.Status403Forbidden };
        }
    }
}
